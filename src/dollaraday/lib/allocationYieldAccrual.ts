import {
  formatEasternIsoDate,
  getMissedEasternDays,
} from "./dateTime";
import { roundYieldCurrency } from "./allocationInstruments";
import { simulateFixedIncomeDailyReturn } from "./allocationDailyReturns";
import {
  getActiveAllocationPositions,
  patchAllocationPosition,
  type AllocationPosition,
} from "./allocationPositions";
import { appendAllocationYieldLogEntry } from "./allocationYieldLog";
import { syncAllocationPoolMetrics } from "./allocationApy";
import { depositToMemberAccount } from "./memberAccounts";
import {
  applyPoolCompoundReturn,
  decreaseDeployedCapital,
  rolloverEasternDayIfNeeded,
} from "./poolState";

const CHECK_INTERVAL_MS = 60_000;
const MAX_CATCH_UP = 366;

let automationTimer: ReturnType<typeof setInterval> | null = null;

function collectAccrualDates(position: AllocationPosition, today: string): string[] {
  if (position.matured) return [];

  const missed = getMissedEasternDays(position.lastAccruedDate, today);
  return missed
    .filter((dayYmd) => dayYmd > position.purchasedDate && dayYmd <= position.maturityDate)
    .slice(0, MAX_CATCH_UP);
}

function accruePositionDay(position: AllocationPosition, dayYmd: string): number {
  const simulation = simulateFixedIncomeDailyReturn(
    position.principal,
    position.annualYieldPct,
    position.id,
    dayYmd,
  );

  if (simulation.amount === 0 && simulation.principalAfter === position.principal) {
    patchAllocationPosition(position.id, { lastAccruedDate: dayYmd });
    return 0;
  }

  patchAllocationPosition(position.id, {
    principal: simulation.principalAfter,
    lastAccruedDate: dayYmd,
  });

  appendAllocationYieldLogEntry({
    positionId: position.id,
    profileId: position.profileId,
    sleeveKey: position.sleeveKey,
    contractLabel: position.contractLabel,
    dayYmd,
    returnPct: simulation.returnPct,
    amount: simulation.amount,
    principalBefore: position.principal,
    principalAfter: simulation.principalAfter,
  });

  return simulation.amount;
}

function settleMaturedPosition(position: AllocationPosition, today: string): boolean {
  if (position.matured || today < position.maturityDate) return false;

  const memo = `${position.contractLabel} maturity · principal returned`;
  const credited = depositToMemberAccount(position.profileId, "escrow", position.principal, memo, {
    occurredAt: `${position.maturityDate}T12:00:00.000Z`,
  });

  if (!credited) return false;

  decreaseDeployedCapital(position.principal);
  patchAllocationPosition(position.id, { matured: true, lastAccruedDate: position.maturityDate });
  return true;
}

export function processAllocationYieldAccrual(today = formatEasternIsoDate()): number {
  rolloverEasternDayIfNeeded();

  let processedCount = 0;
  let netPoolDelta = 0;
  const positions = getActiveAllocationPositions();

  for (const position of positions) {
    if (position.sleeveKey === "stocks") continue;

    const dueDates = collectAccrualDates(position, today);

    for (const dayYmd of dueDates) {
      const current =
        getActiveAllocationPositions().find((item) => item.id === position.id) ?? position;
      if (current.matured) break;

      const delta = accruePositionDay(current, dayYmd);
      netPoolDelta = roundYieldCurrency(netPoolDelta + delta);
      processedCount += 1;
    }

    const refreshed =
      getActiveAllocationPositions().find((item) => item.id === position.id) ?? position;

    if (!refreshed.matured && today >= refreshed.maturityDate) {
      if (settleMaturedPosition(refreshed, today)) {
        processedCount += 1;
      }
    }
  }

  if (netPoolDelta !== 0) {
    applyPoolCompoundReturn(netPoolDelta);
  }

  if (processedCount > 0) {
    syncAllocationPoolMetrics();
  }

  return processedCount;
}

export function startAllocationYieldAutomation(): () => void {
  processAllocationYieldAccrual();

  if (automationTimer) {
    clearInterval(automationTimer);
  }

  automationTimer = setInterval(() => {
    processAllocationYieldAccrual();
  }, CHECK_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      processAllocationYieldAccrual();
    }
  };

  document.addEventListener("visibilitychange", onVisible);

  return () => {
    if (automationTimer) {
      clearInterval(automationTimer);
      automationTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisible);
  };
}
