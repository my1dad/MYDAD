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
 * Pool cash (escrow) for liquidity metrics.
 * When member ledgers are missing/stale in cloud sync but contributions exist,
 * treat unallocated contribution capital as escrow so the live pool is not stuck at $0.
 */
export function getPoolCashEscrowBalance(deployedCapital = 0): number {
  const ledgerEscrow = getTotalMemberEscrowBalance();
  const contributionTotal = getCompletedContributionCapital();
  const deployed = Number.isFinite(deployedCapital) ? Math.max(0, deployedCapital) : 0;

  if (ledgerEscrow + deployed + 0.001 < contributionTotal) {
    return Math.max(0, roundMoney(contributionTotal - deployed));
  }

  return ledgerEscrow;
}
