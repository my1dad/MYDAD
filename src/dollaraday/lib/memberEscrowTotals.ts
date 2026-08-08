import { readDataBin } from "./internalDatabase";

const MEMBER_ACCOUNTS_RECORD_PREFIX = "member-accounts-";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sum escrow balances across all member account ledgers in settings. */
export function getTotalMemberEscrowBalance(): number {
  return roundMoney(
    readDataBin("settings").records
      .filter((record) => record.id.startsWith(MEMBER_ACCOUNTS_RECORD_PREFIX))
      .reduce((sum, record) => sum + (Number(record.payload?.escrowBalance) || 0), 0),
  );
}

/**
 * Admin-funded member deposits (checking set in admin → equity lock on members bin).
 * These must count toward community liquidity even before a contribution ledger exists.
 */
export function getTotalAdminFundedMemberCapital(): number {
  return roundMoney(
    readDataBin("members").records.reduce((sum, record) => {
      const payload = record.payload ?? {};
      if (payload.adminBalancesLocked !== true) return sum;
      const equity = Number(payload.equity);
      const contributed = Number(payload.contributed);
      const amount =
        Number.isFinite(equity) && equity > 0
          ? equity
          : Number.isFinite(contributed) && contributed > 0
            ? contributed
            : 0;
      return sum + amount;
    }, 0),
  );
}

/**
 * Per-ledger deposit capital: max(escrow, checking) so admin-funded checking
 * counts toward the pool without double-counting when both are mirrored equal.
 */
export function getTotalMemberDepositCapitalFromLedgers(): number {
  return roundMoney(
    readDataBin("settings").records
      .filter((record) => record.id.startsWith(MEMBER_ACCOUNTS_RECORD_PREFIX))
      .reduce((sum, record) => {
        const escrow = Number(record.payload?.escrowBalance) || 0;
        const checking = Number(record.payload?.checkingBalance) || 0;
        return sum + Math.max(escrow, checking);
      }, 0),
  );
}

/** Sum completed, non-signup contribution amounts (source of truth for pool donations). */
export function getCompletedContributionCapital(): number {
  return roundMoney(
    readDataBin("contributions").records.reduce((sum, record) => {
      const payload = record.payload ?? {};
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      if (String(payload.type ?? "") === "signup") return sum;
      const status = String(payload.status ?? "completed");
      if (status !== "completed") return sum;
      return sum + amount;
    }, 0),
  );
}

/**
 * Pool cash for liquidity metrics.
 * Includes member escrow/checking deposits, admin-funded equity locks, and
 * contribution capital so community liquidity reflects member deposits.
 */
export function getPoolCashEscrowBalance(deployedCapital = 0): number {
  const ledgerDeposits = getTotalMemberDepositCapitalFromLedgers();
  const adminFunded = getTotalAdminFundedMemberCapital();
  const contributionTotal = getCompletedContributionCapital();
  const deployed = Number.isFinite(deployedCapital) ? Math.max(0, deployedCapital) : 0;
  const cashBase = Math.max(ledgerDeposits, adminFunded);

  if (cashBase + deployed + 0.001 < contributionTotal) {
    return Math.max(0, roundMoney(contributionTotal - deployed));
  }

  return cashBase;
}
