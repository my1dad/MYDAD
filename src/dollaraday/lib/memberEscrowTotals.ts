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

function isInflowContributionType(type: string): boolean {
  return (
    type !== "signup" &&
    type !== "redemption" &&
    type !== "external-payment-request" &&
    type !== "member-redemption-request" &&
    type !== "admin-liquidity-transfer"
  );
}

/** Sum completed, non-signup contribution amounts (source of truth for pool donations). */
export function getCompletedContributionCapital(): number {
  return roundMoney(
    readDataBin("contributions").records.reduce((sum, record) => {
      const payload = record.payload ?? {};
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      const type = String(payload.type ?? "");
      const status = String(payload.status ?? "completed");
      if (status !== "completed") return sum;

      if (type === "admin-liquidity-transfer") {
        return String(payload.direction ?? "") === "to-liquidity" ? sum + amount : sum;
      }
      if (!isInflowContributionType(type)) return sum;
      return sum + amount;
    }, 0),
  );
}

/** Completed liquidity → member redemption outflows only. */
export function getCompletedRedemptionOutflow(): number {
  return roundMoney(
    readDataBin("contributions").records.reduce((sum, record) => {
      const payload = record.payload ?? {};
      if (String(payload.type ?? "") !== "redemption") return sum;
      if (String(payload.status ?? "completed") !== "completed") return sum;
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      return sum + amount;
    }, 0),
  );
}

/** Admin draws from liquidity into the admin operating account. */
export function getAdminLiquidityDrawOutflow(): number {
  return roundMoney(
    readDataBin("contributions").records.reduce((sum, record) => {
      const payload = record.payload ?? {};
      if (String(payload.type ?? "") !== "admin-liquidity-transfer") return sum;
      if (String(payload.direction ?? "") !== "to-admin") return sum;
      if (String(payload.status ?? "completed") !== "completed") return sum;
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      return sum + amount;
    }, 0),
  );
}

/**
 * Pool cash for liquidity metrics.
 * Contribution inflows + admin-funded equity are the source of truth.
 * Summing every member/admin escrow ledger overstates when the same donation
 * was credited on a member wallet and (mistakenly) on admin Chase Escrow.
 * Ledgers are only a fallback when contribution/admin-funded totals are empty.
 *
 * Deployed capital is funded from Admin Cash Account (checking), not pool
 * escrow — do not subtract deployed here or liquidity drops when admin invests.
 */
export function getPoolCashEscrowBalance(_deployedCapital = 0): number {
  const ledgerEscrow = getTotalMemberEscrowBalance();
  const adminFunded = getTotalAdminFundedMemberCapital();
  const contributionTotal = getCompletedContributionCapital();
  const redemptionOutflow = getCompletedRedemptionOutflow();
  const adminDrawOutflow = getAdminLiquidityDrawOutflow();
  const sourceOfTruth = Math.max(contributionTotal, adminFunded);
  const cashBase = sourceOfTruth > 0 ? sourceOfTruth : ledgerEscrow;

  return Math.max(0, roundMoney(cashBase - redemptionOutflow - adminDrawOutflow));
}
