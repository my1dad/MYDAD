import {
  computeDailyYieldAmount,
  computeTermYieldAmount,
  computeTermYieldPercent,
  findAllocationContractTerm,
  roundYieldCurrency,
} from "./allocationInstruments";
import { getAllocationYieldLogEntries } from "./allocationYieldLog";
import type { AllocationPosition } from "./allocationPositions";
import { computeStockPositionMetrics } from "./massiveMarket";
import { addEasternDays, formatEasternIsoDate } from "./dateTime";

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

/** Calendar days after purchase through endYmd (matches fixed-income accrual window). */
function countHeldYieldDays(purchasedDate: string, endYmd: string): number {
  if (!purchasedDate || !endYmd || endYmd <= purchasedDate) return 0;

  let heldDays = 0;
  let cursor = addEasternDays(purchasedDate, 1);
  while (cursor <= endYmd && heldDays < 400) {
    heldDays += 1;
    if (cursor === endYmd) break;
    cursor = addEasternDays(cursor, 1);
  }
  return heldDays;
}

function getFixedIncomeCostBasis(position: AllocationPosition): number {
  const entries = getAllocationYieldLogEntries()
    .filter((entry) => entry.positionId === position.id)
    .sort((a, b) => a.dayYmd.localeCompare(b.dayYmd));

  const first = entries[0];
  if (first && Number.isFinite(first.principalBefore) && first.principalBefore > 0) {
    return roundYieldCurrency(first.principalBefore);
  }

  return roundYieldCurrency(Number(position.principal) || 0);
}

/**
 * Fixed-income ROI:
 * 1) Summed yield-log P/L when accruals exist
 * 2) Else contract daily rate × days held
 * 3) Else full contract-term projected profit (same-day purchase)
 */
function getFixedIncomePositionRoi(position: AllocationPosition): AllocationRoi {
  const costBasis = getFixedIncomeCostBasis(position);
  if (costBasis <= 0) return { amount: 0, pct: 0 };

  const entries = getAllocationYieldLogEntries().filter(
    (entry) => entry.positionId === position.id,
  );
  const loggedProfit = roundYieldCurrency(
    entries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0),
  );

  const today = formatEasternIsoDate();
  const endYmd =
    position.maturityDate && position.maturityDate < today
      ? position.maturityDate
      : today;
  const heldDays = countHeldYieldDays(position.purchasedDate, endYmd);
  const proRataProfit = roundYieldCurrency(
    computeDailyYieldAmount(costBasis, position.annualYieldPct) * heldDays,
  );

  let amount = Math.abs(loggedProfit) > 0.0001 ? loggedProfit : proRataProfit;
  let pct = roundYieldCurrency((amount / costBasis) * 100);

  // Purchase day (no accrued days yet): show full contract expected profit.
  if (Math.abs(amount) < 0.0001) {
    const term = findAllocationContractTerm(position.contractId);
    if (term) {
      amount = computeTermYieldAmount(costBasis, term);
      pct = computeTermYieldPercent(term);
    } else {
      // Fallback when contract id is unknown — annualize over remaining term dates.
      const termDays = Math.max(
        1,
        countHeldYieldDays(position.purchasedDate, position.maturityDate) ||
          heldDays ||
          1,
      );
      amount = roundYieldCurrency(
        computeDailyYieldAmount(costBasis, position.annualYieldPct) * termDays,
      );
      pct = roundYieldCurrency((amount / costBasis) * 100);
    }
  }

  return { amount, pct };
}

export function getPositionRoi(position: AllocationPosition): AllocationRoi {
  if (position.sleeveKey === "stocks") {
    const shares = position.contracts;
    const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
    const market = position.marketPrice ?? entry;
    const metrics = computeStockPositionMetrics(shares, entry, market);
    return { amount: metrics.pnl, pct: metrics.pnlPct };
  }

  return getFixedIncomePositionRoi(position);
}

export function getSleeveRoi(positions: AllocationPosition[]): AllocationRoi {
  if (!positions.length) return { amount: 0, pct: 0 };

  let totalValue = 0;
  let totalRoi = 0;

  positions.forEach((position) => {
    const roi = getPositionRoi(position);
    totalRoi += roi.amount;
    totalValue +=
      position.sleeveKey === "stocks" ? getStockPositionValue(position) : getFixedIncomeCostBasis(position);
  });

  const pct = totalValue > 0 ? roundYieldCurrency((totalRoi / totalValue) * 100) : 0;
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
