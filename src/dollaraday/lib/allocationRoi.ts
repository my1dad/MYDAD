import { roundYieldCurrency } from "./allocationInstruments";
import { getAllocationYieldLogEntries } from "./allocationYieldLog";
import type { AllocationPosition } from "./allocationPositions";
import { computeStockPositionMetrics } from "./massiveMarket";

export interface AllocationRoi {
  amount: number;
  pct: number;
}

function getStockPositionValue(position: AllocationPosition): number {
  const shares = position.contracts;
  const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
  const market = position.marketPrice ?? entry;
  return roundYieldCurrency(shares * market);
}

export function getPositionRoi(position: AllocationPosition): AllocationRoi {
  if (position.sleeveKey === "stocks") {
    const shares = position.contracts;
    const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
    const market = position.marketPrice ?? entry;
    const metrics = computeStockPositionMetrics(shares, entry, market);
    return { amount: metrics.pnl, pct: metrics.pnlPct };
  }

  const entries = getAllocationYieldLogEntries().filter((entry) => entry.positionId === position.id);
  const amount = roundYieldCurrency(entries.reduce((sum, entry) => sum + entry.amount, 0));
  const costBasis = roundYieldCurrency(position.principal - amount);
  const pct = costBasis > 0 ? roundYieldCurrency((amount / costBasis) * 100) : 0;
  return { amount, pct };
}

export function getSleeveRoi(positions: AllocationPosition[]): AllocationRoi {
  if (!positions.length) return { amount: 0, pct: 0 };

  let totalValue = 0;
  let totalRoi = 0;

  positions.forEach((position) => {
    const roi = getPositionRoi(position);
    totalRoi += roi.amount;
    totalValue +=
      position.sleeveKey === "stocks" ? getStockPositionValue(position) : position.principal;
  });

  const costBasis = totalValue - totalRoi;
  const pct = costBasis > 0 ? roundYieldCurrency((totalRoi / costBasis) * 100) : 0;
  return { amount: roundYieldCurrency(totalRoi), pct };
}

export function getPositionAllocatedValue(position: AllocationPosition): number {
  if (position.sleeveKey === "stocks") return getStockPositionValue(position);
  return position.principal;
}

export function getPositionApy(position: AllocationPosition): number {
  if (position.sleeveKey === "stocks") {
    const roi = getPositionRoi(position);
    return roi.pct;
  }
  return position.annualYieldPct;
}
