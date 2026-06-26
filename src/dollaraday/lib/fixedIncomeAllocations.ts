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
import { depositToMemberAccount, resolveMemberProfileId } from "./memberAccounts";

export type FixedIncomeTradeResult = "ok" | "invalid" | "not_found";

export function isFixedIncomePosition(position: AllocationPosition): boolean {
  return (
    (position.sleeveKey === "treasury" || position.sleeveKey === "bonds") &&
    !position.matured
  );
}

export function sellFixedIncomeAllocation(positionId: string): FixedIncomeTradeResult {
  const profileId = resolveMemberProfileId();
  const position = getActiveAllocationPositions().find(
    (item) => item.id === positionId && item.profileId === profileId,
  );

  if (!position || !isFixedIncomePosition(position)) return "not_found";

  const proceeds = roundYieldCurrency(position.principal);
  if (proceeds <= 0) return "invalid";

  const symbol = position.sleeveKey === "treasury" ? "Treasury" : "Bond";
  const credited = depositToMemberAccount(
    profileId,
    "escrow",
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

  decreaseDeployedCapital(proceeds);
  closeAllocationPosition(position.id);
  processAllocationYieldAccrual();
  return "ok";
}
