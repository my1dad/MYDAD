import { readDataBin } from "./internalDatabase";
import {
  depositDonationToPlatformEscrow,
  getAdminProfileId,
  hydrateMemberAccounts,
  invalidateMemberAccountsCache,
  resolvePlatformEscrowProfileId,
} from "./memberAccounts";

const SIGNUP_TYPE = "signup";
const WALLET_DEPOSIT_TYPE = "wallet-deposit";
const EXTERNAL_PAYMENT_TYPE = "external-payment-request";
const MEMBER_REDEMPTION_REQUEST_TYPE = "member-redemption-request";
const REDEMPTION_TYPE = "redemption";
const ADMIN_LIQUIDITY_TYPE = "admin-liquidity-transfer";
const CASH_REINVEST_SOURCE = "cash-reinvest";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Types that settle on member ledgers (or are non-cash), not master admin Chase Escrow. */
function isMemberSettledOrNonPlatformType(type: string, source: string, funding: string): boolean {
  if (
    type === SIGNUP_TYPE ||
    type === WALLET_DEPOSIT_TYPE ||
    type === EXTERNAL_PAYMENT_TYPE ||
    type === MEMBER_REDEMPTION_REQUEST_TYPE ||
    type === REDEMPTION_TYPE ||
    type === ADMIN_LIQUIDITY_TYPE
  ) {
    return true;
  }
  if (source === WALLET_DEPOSIT_TYPE || source === EXTERNAL_PAYMENT_TYPE) return true;
  if (source === CASH_REINVEST_SOURCE || funding === "cash-balance") return true;
  return false;
}

function isCompletedDonation(payload: Record<string, unknown>): boolean {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const type = String(payload.type ?? "");
  if (type === SIGNUP_TYPE || type === WALLET_DEPOSIT_TYPE) return false;
  const status = String(payload.status ?? "completed");
  return status === "completed";
}

/**
 * Home contributions that settle on master admin Chase Escrow only.
 * Payment-request / wallet-deposit / cash-reinvest already credit member escrow —
 * counting them here caused a second admin credit and doubled pool liquidity.
 */
function isPlatformDonationRecord(record: {
  source: string;
  payload?: Record<string, unknown>;
}): boolean {
  const payload = record.payload ?? {};
  if (!isCompletedDonation(payload)) return false;
  const type = String(payload.type ?? "");
  const source = String(record.source || payload.source || "");
  const funding = String(payload.funding ?? "");
  if (isMemberSettledOrNonPlatformType(type, source, funding)) return false;
  return true;
}

function isDonationEscrowCredit(memo: string | undefined): boolean {
  if (!memo) return false;
  const lower = memo.toLowerCase();
  return (
    lower.includes("contribution") ||
    lower.includes("donation") ||
    lower.includes("home contribution") ||
    lower.includes("recurring")
  );
}

/** Sum completed contribution amounts grouped by profileId (fallback: memberId). */
export function getContributionTotalsByProfile(): Map<string, number> {
  const totals = new Map<string, number>();

  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (!isCompletedDonation(payload)) return;

    const profileId = String(payload.profileId ?? payload.memberId ?? "").trim();
    if (!profileId) return;

    const amount = Number(payload.amount);
    totals.set(profileId, roundMoney((totals.get(profileId) ?? 0) + amount));
  });

  return totals;
}

function sumPlatformDonationContributionTotal(): number {
  let total = 0;
  readDataBin("contributions").records.forEach((record) => {
    if (!isPlatformDonationRecord(record)) return;
    total += Number(record.payload?.amount) || 0;
  });
  return roundMoney(total);
}

function sumDonationEscrowCreditsAcrossLedgers(): number {
  let total = 0;
  readDataBin("settings")
    .records.filter((record) => record.id.startsWith("member-accounts-"))
    .forEach((record) => {
      const rows = Array.isArray(record.payload?.transactions)
        ? (record.payload.transactions as Array<{
            accountId?: string;
            direction?: string;
            amount?: number;
            memo?: string;
          }>)
        : [];

      rows.forEach((transaction) => {
        if (transaction.accountId !== "escrow") return;
        if (transaction.direction !== "credit") return;
        if (!isDonationEscrowCredit(transaction.memo)) return;
        const amount = Number(transaction.amount);
        if (Number.isFinite(amount) && amount > 0) total += amount;
      });
    });

  return roundMoney(total);
}

/**
 * Backfill master admin Chase Escrow from completed member donations when
 * ledgers are missing credits (pool capital would otherwise stay understated).
 * Avoids double-counting donations already credited on any member/admin ledger.
 */
export function reconcileMemberEscrowFromContributions(): boolean {
  const donationTotal = sumPlatformDonationContributionTotal();
  if (donationTotal <= 0) return false;

  const alreadyCredited = sumDonationEscrowCreditsAcrossLedgers();
  const shortfall = roundMoney(donationTotal - alreadyCredited);
  if (shortfall <= 0) return false;

  const platformId = resolvePlatformEscrowProfileId(getAdminProfileId());
  const next = depositDonationToPlatformEscrow(
    shortfall,
    "Contribution credited to Chase Escrow",
    { donorProfileId: platformId },
  );
  if (!next) return false;

  invalidateMemberAccountsCache();
  return true;
}

/** Ensure donations for a profile are reflected on master admin Chase Escrow. */
export function ensureProfileEscrowFromContributions(profileId: string): boolean {
  if (!profileId) return false;
  // Platform model: all member donations settle on admin escrow.
  return reconcileMemberEscrowFromContributions();
}

/** Debug/helper — current admin escrow ledger snapshot. */
export function getPlatformEscrowBalance(): number {
  const platformId = getAdminProfileId();
  if (!platformId) return 0;
  return Number(hydrateMemberAccounts(platformId).escrowBalance) || 0;
}
