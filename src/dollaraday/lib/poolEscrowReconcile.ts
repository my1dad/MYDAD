import { readDataBin } from "./internalDatabase";
import {
  depositToMemberAccount,
  hydrateMemberAccounts,
  invalidateMemberAccountsCache,
} from "./memberAccounts";

const SIGNUP_TYPE = "signup";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isCompletedDonation(payload: Record<string, unknown>): boolean {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (String(payload.type ?? "") === SIGNUP_TYPE) return false;
  const status = String(payload.status ?? "completed");
  return status === "completed";
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

function sumEscrowCredits(profileId: string): number {
  const ledger = hydrateMemberAccounts(profileId);
  return roundMoney(
    ledger.transactions.reduce((sum, transaction) => {
      if (transaction.accountId !== "escrow") return sum;
      if (transaction.direction !== "credit") return sum;
      const amount = Number(transaction.amount);
      return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
    }, 0),
  );
}

/**
 * Backfill Chase Escrow ledgers from completed contributions when cloud/local
 * settings are missing member-accounts records (pool capital would otherwise stay $0).
 * Returns true when any ledger was updated.
 */
export function reconcileMemberEscrowFromContributions(): boolean {
  const totals = getContributionTotalsByProfile();
  if (totals.size === 0) return false;

  let changed = false;

  totals.forEach((contributionTotal, profileId) => {
    const credited = sumEscrowCredits(profileId);
    const shortfall = roundMoney(contributionTotal - credited);
    if (shortfall <= 0) return;

    const next = depositToMemberAccount(
      profileId,
      "escrow",
      shortfall,
      "Reconcile contribution capital into liquidity pool",
    );
    if (next) changed = true;
  });

  if (changed) {
    invalidateMemberAccountsCache();
  }

  return changed;
}
