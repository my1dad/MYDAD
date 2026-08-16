import {
  closeAllocationPosition,
  getActiveAllocationPositions,
  type AllocationPosition,
} from "./allocationPositions";
import { roundYieldCurrency } from "./allocationInstruments";
import { appendAllocationYieldLogEntry } from "./allocationYieldLog";
import { processAllocationYieldAccrual } from "./allocationYieldAccrual";
import { getPositionRoi } from "./allocationRoi";
import { formatEasternIsoDate } from "./dateTime";
import { decreaseDeployedCapital } from "./poolState";
import { depositToMemberAccount, resolvePlatformEscrowProfileId } from "./memberAccounts";

export type FixedIncomeTradeResult = "ok" | "invalid" | "not_found";

export function isFixedIncomePosition(position: AllocationPosition): boolean {
  return (
    (position.sleeveKey === "treasury" || position.sleeveKey === "bonds") &&
    !position.matured
  );
}

export function sellFixedIncomeAllocation(positionId: string): FixedIncomeTradeResult {
  const platformProfileId = resolvePlatformEscrowProfileId();
  const position = getActiveAllocationPositions().find((item) => item.id === positionId);

  if (!position || !isFixedIncomePosition(position)) return "not_found";

  const proceeds = roundYieldCurrency(position.principal);
  if (proceeds <= 0) return "invalid";

  const symbol = position.sleeveKey === "treasury" ? "Treasury" : "Bond";
  // Proceeds return to Admin Cash Account (same sink buys debit).
  const credited = depositToMemberAccount(
    platformProfileId,
    "checking",
    proceeds,
    `${position.contractLabel} · ${symbol} early redemption · $${proceeds.toFixed(2)}`,
  );

  if (!credited) return "invalid";

  const roi = getPositionRoi(position);
  appendAllocationYieldLogEntry({
    positionId: position.id,
    profileId: position.profileId,
    sleeveKey: position.sleeveKey,
    contractLabel: position.contractLabel,
    dayYmd: formatEasternIsoDate(),
    returnPct: roi.pct,
    amount: roi.amount,
    principalBefore: position.principal,
    principalAfter: position.principal,
  });

  // Close first so Total Deployed recalculates without this principal.
  closeAllocationPosition(position.id);
  decreaseDeployedCapital(proceeds);
  processAllocationYieldAccrual();
  return "ok";
}
