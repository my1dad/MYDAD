import { isAdminProfile } from "../../config/admin";
import { getDadProfiles } from "./dadProfileStorage";
import { addEasternDays, formatEasternIsoDate } from "./dateTime";
import { readDataBin } from "./internalDatabase";

export interface MemberContributionStats {
  contributed: number;
  /** Completed donations only (excludes wallet deposits). */
  donated: number;
  /** Wallet-deposit contributions only. */
  deposited: number;
  equity: number;
  days: number;
  streak: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isCompletedDonation(payload: Record<string, unknown>): boolean {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (String(payload.type ?? "") === "signup") return false;
  return String(payload.status ?? "completed") === "completed";
}

function contributionProfileId(payload: Record<string, unknown>): string {
  return String(payload.profileId ?? payload.memberId ?? "").trim();
}

function contributionYmd(payload: Record<string, unknown>, fallback = ""): string {
  const raw = String(payload.contributedAt ?? fallback ?? "");
  if (!raw) return "";
  return formatEasternIsoDate(raw);
}

/** Consecutive contribution days ending on the latest donation day (0 if stale >1 day). */
export function computeContributionStreak(ymds: string[], today = formatEasternIsoDate()): number {
  const unique = Array.from(new Set(ymds.filter(Boolean))).sort((a, b) => b.localeCompare(a));
  if (!unique.length) return 0;

  const latest = unique[0];
  const yesterday = addEasternDays(today, -1);
  if (latest < yesterday) return 0;

  let streak = 0;
  let expected = latest;
  for (const ymd of unique) {
    if (ymd === expected) {
      streak += 1;
      expected = addEasternDays(expected, -1);
      continue;
    }
    if (ymd < expected) break;
  }
  return streak;
}

export function computeMemberStatsFromContributions(
  profileId: string,
  today = formatEasternIsoDate(),
): MemberContributionStats {
  const ymds: string[] = [];
  let contributed = 0;
  let donated = 0;
  let deposited = 0;

  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (contributionProfileId(payload) !== profileId) return;
    if (!isCompletedDonation(payload)) return;

    const amount = Number(payload.amount);
    contributed += amount;
    if (String(payload.type ?? "") === "wallet-deposit" || record.source === "wallet-deposit") {
      deposited += amount;
    } else {
      donated += amount;
    }
    const ymd = contributionYmd(payload, record.createdAt);
    if (ymd) ymds.push(ymd);
  });

  const uniqueDays = Array.from(new Set(ymds));
  const days = uniqueDays.length;
  const roundedContributed = roundMoney(contributed);
  const roundedDonated = roundMoney(donated);

  return {
    contributed: roundedContributed,
    donated: roundedDonated,
    deposited: roundMoney(deposited),
    // Equity tracks donation + deposit capital until yield overlays are applied separately.
    equity: roundedContributed,
    days,
    streak: computeContributionStreak(uniqueDays, today),
  };
}

/** Profile ids that have at least one completed contribution. */
export function listContributionProfileIds(): string[] {
  const ids = new Set<string>();
  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (!isCompletedDonation(payload)) return;
    const profileId = contributionProfileId(payload);
    if (profileId) ids.add(profileId);
  });
  return Array.from(ids);
}

/**
 * Platform-wide completed donations from member roles only
 * (excludes wallet deposits and master-admin contributions).
 */
export function getPlatformMemberDonationTotals(): { donated: number; count: number } {
  const adminProfileIds = new Set(
    getDadProfiles()
      .filter((profile) => isAdminProfile(profile))
      .map((profile) => profile.id),
  );

  let donated = 0;
  let count = 0;
  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (!isCompletedDonation(payload)) return;
    if (isWalletDepositContribution(record.source, payload)) return;

    const profileId = contributionProfileId(payload);
    if (profileId && adminProfileIds.has(profileId)) return;

    donated += Number(payload.amount) || 0;
    count += 1;
  });

  return { donated: roundMoney(donated), count };
}

export function sumPlatformMemberDonations(): number {
  return getPlatformMemberDonationTotals().donated;
}

/** Activity row for wallet Recent activity (ledger + contribution donations). */
export type MemberWalletActivityKind = "deposit" | "donation" | "recurring" | "spend" | "transfer";

export interface MemberWalletActivityItem {
  id: string;
  accountId: "checking" | "escrow";
  type: MemberWalletActivityKind;
  direction: "credit" | "debit";
  amount: number;
  balanceAfter?: number;
  counterpartyAccountId?: "checking" | "escrow";
  memo?: string;
  createdAt: string;
  /** Contribution-backed rows cannot be edited from the ledger UI. */
  source: "ledger" | "contribution";
  frequency?: string;
}

type LedgerLikeTransaction = {
  id: string;
  accountId: "checking" | "escrow";
  type: "deposit" | "spend" | "transfer";
  direction: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  counterpartyAccountId?: "checking" | "escrow";
  memo?: string;
  createdAt: string;
};

function isWalletDepositContribution(
  source: string,
  payload: Record<string, unknown>,
): boolean {
  return String(payload.type ?? "") === "wallet-deposit" || source === "wallet-deposit";
}

function isRecurringContribution(
  source: string,
  payload: Record<string, unknown>,
): boolean {
  if (source === "recurring-home-contribution") return true;
  if (String(payload.type ?? "") === "recurring") return true;
  return Boolean(payload.recurringEnabled);
}

function matchesLedgerDeposit(
  amount: number,
  createdAt: string,
  ledger: LedgerLikeTransaction[],
): boolean {
  const contribMs = Date.parse(createdAt);
  return ledger.some((tx) => {
    if (tx.type !== "deposit") return false;
    if (Math.abs(tx.amount - amount) > 0.001) return false;
    if (!Number.isFinite(contribMs)) return true;
    const txMs = Date.parse(tx.createdAt);
    if (!Number.isFinite(txMs)) return false;
    return Math.abs(txMs - contribMs) <= 120_000;
  });
}

/**
 * Wallet Recent activity: member ledger posts plus donations / recurring
 * contribution records (which settle on platform escrow and never hit the ledger).
 */
export function buildMemberWalletActivity(
  profileId: string,
  ledgerTransactions: LedgerLikeTransaction[],
): MemberWalletActivityItem[] {
  const items: MemberWalletActivityItem[] = ledgerTransactions.map((tx) => ({
    ...tx,
    type: tx.type,
    source: "ledger" as const,
  }));

  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (contributionProfileId(payload) !== profileId) return;
    if (!isCompletedDonation(payload)) return;

    const amount = Number(payload.amount);
    const createdAt = String(payload.contributedAt ?? record.createdAt ?? "");
    if (!createdAt) return;

    if (isWalletDepositContribution(record.source, payload)) {
      if (matchesLedgerDeposit(amount, createdAt, ledgerTransactions)) return;
      items.push({
        id: `contrib-${record.id}`,
        accountId: "checking",
        type: "deposit",
        direction: "credit",
        amount,
        createdAt,
        memo: String(payload.memo ?? "").trim() || undefined,
        source: "contribution",
      });
      return;
    }

    const recurring = isRecurringContribution(record.source, payload);
    const frequency = String(payload.frequency ?? "").trim() || undefined;
    items.push({
      id: `contrib-${record.id}`,
      accountId: "checking",
      type: recurring ? "recurring" : "donation",
      direction: "debit",
      amount,
      createdAt,
      memo: String(payload.memo ?? "").trim() || undefined,
      source: "contribution",
      frequency,
    });
  });

  return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function memberStatsEqual(
  left: Pick<MemberContributionStats, "contributed" | "equity" | "days" | "streak">,
  right: Pick<MemberContributionStats, "contributed" | "equity" | "days" | "streak">,
): boolean {
  return (
    left.contributed === right.contributed &&
    left.equity === right.equity &&
    left.days === right.days &&
    left.streak === right.streak
  );
}
