import { useSyncExternalStore, useMemo } from "react";
import { DDA_THEME } from "./theme";
import {
  computeDailyYieldAmount,
  roundYieldCurrency,
} from "./allocationInstruments";
import {
  getAllocationYieldLogEntries,
  getLatestDailyReturnPctBySleeve,
} from "./allocationYieldLog";
import {
  getActiveAllocationPositions,
  subscribeAllocationPositions,
  useAllocationPositions,
  type AllocationPosition,
} from "./allocationPositions";
import type { AllocationSleeveKey } from "./allocationPurchases";
import { getBlendedContractApy } from "./allocationApy";
import { getSleeveRoi } from "./allocationRoi";
import { readDataBin, subscribeInternalDatabase } from "./internalDatabase";
import type { MemberAccountTransaction } from "./memberAccounts";
import { formatEasternMonthDay, formatEasternShortDate, formatEasternWeekdayShort, formatEasternIsoDate, addEasternDays } from "./dateTime";
import type { AllocationYieldLogEntry } from "./allocationYieldLog";

export type YieldTrendInterval = "1d" | "1m" | "3m" | "1y";

function getYieldTrendPointCount(interval: YieldTrendInterval): number {
  if (interval === "1d") return 7;
  if (interval === "1m") return 4;
  if (interval === "3m") return 6;
  return 8;
}

interface YieldTrendPoint {
  ymd: string;
  label: string;
  apy: number;
}

function getSleevePositionsForKey(
  sleeveKey: AllocationSleeveKey,
  positions: AllocationPosition[],
): AllocationPosition[] {
  return positions.filter((position) => position.sleeveKey === sleeveKey && !position.matured);
}

function getFirstPurchaseYmd(positions: AllocationPosition[]): string | null {
  if (!positions.length) return null;
  return positions.reduce(
    (earliest, position) => (position.purchasedDate < earliest ? position.purchasedDate : earliest),
    positions[0].purchasedDate,
  );
}

function enumerateEasternDays(fromYmd: string, toYmd: string): string[] {
  if (!fromYmd || !toYmd || fromYmd > toYmd) return [];

  const days: string[] = [];
  let cursor = fromYmd;
  while (days.length < 400) {
    days.push(cursor);
    if (cursor === toYmd) break;
    cursor = addEasternDays(cursor, 1);
  }
  return days;
}

function getIntervalStartYmd(interval: YieldTrendInterval, today: string): string {
  if (interval === "1d") return addEasternDays(today, -6);
  if (interval === "1m") return addEasternDays(today, -29);
  if (interval === "3m") return addEasternDays(today, -89);
  return addEasternDays(today, -364);
}

function formatYieldTrendLabel(
  ymd: string,
  interval: YieldTrendInterval,
  isToday: boolean,
): string {
  if (isToday) return "Now";
  if (interval === "1d") return formatEasternWeekdayShort(`${ymd}T12:00:00.000Z`);
  return formatEasternMonthDay(`${ymd}T12:00:00.000Z`);
}

function getStockPositionRoiPctAtYmd(
  position: AllocationPosition,
  logEntries: AllocationYieldLogEntry[],
  ymd: string,
  isToday: boolean,
): number {
  if (position.purchasedDate > ymd) return 0;

  const positionLogs = logEntries
    .filter((entry) => entry.positionId === position.id && entry.dayYmd <= ymd)
    .sort((a, b) => a.dayYmd.localeCompare(b.dayYmd));

  const exact = positionLogs.filter((entry) => entry.dayYmd === ymd).pop();
  if (exact) return exact.returnPct;

  const prior = positionLogs.pop();
  if (prior) return prior.returnPct;

  if (position.purchasedDate === ymd) return 0;
  if (isToday) return getPositionReturnPct(position);

  return 0;
}

function computeStockSleeveRoiAtYmd(
  sleevePositions: AllocationPosition[],
  logEntries: AllocationYieldLogEntry[],
  ymd: string,
  isToday: boolean,
): number {
  const active = sleevePositions.filter((position) => position.purchasedDate <= ymd);
  if (!active.length) return 0;

  const totalWeight = active.reduce((sum, position) => sum + position.principal, 0);
  if (totalWeight <= 0) return 0;

  const weighted = active.reduce((sum, position) => {
    const roiPct = getStockPositionRoiPctAtYmd(position, logEntries, ymd, isToday);
    return sum + roiPct * position.principal;
  }, 0);

  return roundYieldCurrency(weighted / totalWeight);
}

function buildDailyYieldTrendSeries(
  sleeveKey: AllocationSleeveKey,
  sleevePositions: AllocationPosition[],
  logEntries: AllocationYieldLogEntry[],
  fromYmd: string,
  toYmd: string,
  interval: YieldTrendInterval,
): YieldTrendPoint[] {
  const firstPurchase = getFirstPurchaseYmd(sleevePositions);
  if (!firstPurchase) {
    return [{ ymd: toYmd, label: "Now", apy: 0 }];
  }

  const baselineYmd = addEasternDays(firstPurchase, -1);
  const startYmd = baselineYmd < fromYmd ? baselineYmd : fromYmd;
  const days = enumerateEasternDays(startYmd, toYmd);
  let compound = 1;

  const points = days.map((ymd) => {
    const isToday = ymd === toYmd;
    let returnPct = 0;

    if (ymd <= baselineYmd) {
      returnPct = 0;
    } else if (sleeveKey === "stocks") {
      returnPct = computeStockSleeveRoiAtYmd(sleevePositions, logEntries, ymd, isToday);
    } else {
      const active = sleevePositions.filter((position) => position.purchasedDate < ymd);
      const dayLogs = logEntries.filter(
        (entry) =>
          entry.dayYmd === ymd &&
          entry.sleeveKey === sleeveKey &&
          active.some((position) => position.id === entry.positionId),
      );

      if (active.length) {
        if (dayLogs.length) {
          const totalPrincipal = dayLogs.reduce((sum, entry) => sum + entry.principalBefore, 0);
          const weightedDaily =
            totalPrincipal > 0
              ? dayLogs.reduce((sum, entry) => sum + entry.returnPct * entry.principalBefore, 0) /
                totalPrincipal
              : 0;
          compound *= 1 + weightedDaily / 100;
        }
        returnPct = roundYieldCurrency((compound - 1) * 100);
      }
    }

    return {
      ymd,
      label: formatYieldTrendLabel(ymd, interval, isToday),
      apy: returnPct,
    };
  });

  const last = points[points.length - 1];
  if (last && sleevePositions.length) {
    last.apy = getSleeveRoi(sleevePositions).pct;
    last.label = "Now";
  }

  return points;
}

function sampleYieldTrendPoints(
  dailyPoints: YieldTrendPoint[],
  interval: YieldTrendInterval,
  toYmd: string,
): YieldTrendPoint[] {
  if (!dailyPoints.length) return [{ ymd: toYmd, label: "Now", apy: 0 }];

  if (interval === "1d") {
    return dailyPoints.slice(-7).map((point) => ({
      ...point,
      label: formatYieldTrendLabel(point.ymd, interval, point.ymd === toYmd),
    }));
  }

  const pointCount = getYieldTrendPointCount(interval);
  if (dailyPoints.length <= pointCount) {
    return dailyPoints.map((point) => ({
      ...point,
      label: formatYieldTrendLabel(point.ymd, interval, point.ymd === toYmd),
    }));
  }

  const bucketSize = Math.max(1, Math.ceil(dailyPoints.length / pointCount));
  const buckets: YieldTrendPoint[] = [];

  for (let index = 0; index < dailyPoints.length; index += bucketSize) {
    const slice = dailyPoints.slice(index, index + bucketSize);
    const last = slice[slice.length - 1];
    if (!last) continue;
    buckets.push({
      ...last,
      label: formatYieldTrendLabel(last.ymd, interval, last.ymd === toYmd),
    });
  }

  const finalPoint = dailyPoints[dailyPoints.length - 1];
  if (finalPoint && buckets[buckets.length - 1]?.ymd !== finalPoint.ymd) {
    buckets.push({
      ...finalPoint,
      label: "Now",
    });
  }

  return buckets;
}

export const ALLOCATION_SLEEVE_KEYS: AllocationSleeveKey[] = ["treasury", "bonds", "stocks"];

export const ALLOCATION_SLEEVE_META: Record<
  AllocationSleeveKey,
  { color: string; risk: "Low" | "Medium"; liquidity: "High" | "Medium" }
> = {
  treasury: { color: DDA_THEME.green, risk: "Low", liquidity: "High" },
  bonds: { color: "#8b5cf6", risk: "Medium", liquidity: "Medium" },
  stocks: { color: "#38bdf8", risk: "Medium", liquidity: "Medium" },
};

export interface SleeveAllocationSummary {
  sleeveKey: AllocationSleeveKey;
  principal: number;
  percent: number;
  blendedApy: number;
  positionCount: number;
  dailyYield: number;
  monthlyYield: number;
}

function weightedApy(positions: AllocationPosition[]): number {
  const total = positions.reduce((sum, position) => sum + position.principal, 0);
  if (total <= 0) return 0;
  const weighted = positions.reduce(
    (sum, position) => sum + position.principal * position.annualYieldPct,
    0,
  );
  return roundYieldCurrency(weighted / total);
}

function getPositionDeployedValue(position: AllocationPosition): number {
  if (position.sleeveKey === "stocks") {
    const shares = position.contracts;
    const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
    const market = position.marketPrice ?? entry;
    return roundYieldCurrency(shares * market);
  }
  return position.principal;
}

export function getTotalDeployedCapital(
  positions: AllocationPosition[] = getActiveAllocationPositions(),
): number {
  return positions
    .filter((position) => !position.matured)
    .reduce((sum, position) => sum + getPositionDeployedValue(position), 0);
}

function getPositionReturnPct(position: AllocationPosition): number {
  if (position.sleeveKey !== "stocks") return position.annualYieldPct;
  const shares = position.contracts;
  const entry = position.entryPrice ?? (shares > 0 ? position.principal / shares : 0);
  const market = position.marketPrice ?? entry;
  if (entry <= 0) return 0;
  return roundYieldCurrency(((market - entry) / entry) * 100);
}

export function summarizeSleeveAllocations(
  positions: AllocationPosition[] = getActiveAllocationPositions(),
): SleeveAllocationSummary[] {
  const active = positions.filter((position) => !position.matured);
  const totalDeployed = active.reduce((sum, position) => sum + getPositionDeployedValue(position), 0);

  return ALLOCATION_SLEEVE_KEYS.map((sleeveKey) => {
    const sleevePositions = active.filter((position) => position.sleeveKey === sleeveKey);
    const principal = sleevePositions.reduce(
      (sum, position) => sum + getPositionDeployedValue(position),
      0,
    );
    const dailyYield = sleevePositions.reduce((sum, position) => {
      if (position.sleeveKey === "stocks") return sum;
      return sum + computeDailyYieldAmount(position.principal, position.annualYieldPct);
    }, 0);

    const latestActualDailyPct =
      sleeveKey === "stocks" ? null : getLatestDailyReturnPctBySleeve(sleeveKey);
    const actualDailyYield =
      latestActualDailyPct != null
        ? roundYieldCurrency(
            sleevePositions.reduce((sum, position) => {
              if (position.sleeveKey === "stocks") return sum;
              return sum + roundYieldCurrency(position.principal * (latestActualDailyPct / 100));
            }, 0),
          )
        : dailyYield;

    const blendedApy =
      sleeveKey === "stocks"
        ? weightedReturnPct(sleevePositions)
        : weightedApy(sleevePositions);

    return {
      sleeveKey,
      principal,
      percent: totalDeployed > 0 ? Math.round((principal / totalDeployed) * 100) : 0,
      blendedApy,
      positionCount: sleevePositions.length,
      dailyYield: roundYieldCurrency(actualDailyYield),
      monthlyYield: roundYieldCurrency(actualDailyYield * 30),
    };
  });
}

function weightedReturnPct(positions: AllocationPosition[]): number {
  const total = positions.reduce((sum, position) => sum + getPositionDeployedValue(position), 0);
  if (total <= 0) return 0;
  const weighted = positions.reduce(
    (sum, position) => sum + getPositionDeployedValue(position) * getPositionReturnPct(position),
    0,
  );
  return roundYieldCurrency(weighted / total);
}

export function mergeLocalizedSleeveInvestments(
  localizedInvestments: Array<Record<string, unknown>>,
  summaries: SleeveAllocationSummary[],
) {
  return localizedInvestments.map((item, index) => {
    const sleeveKey = (item.key as AllocationSleeveKey | undefined) ?? ALLOCATION_SLEEVE_KEYS[index];
    const summary = summaries.find((entry) => entry.sleeveKey === sleeveKey);

    return {
      ...item,
      key: sleeveKey,
      allocated: Math.round(summary?.principal ?? 0),
      percent: summary?.percent ?? 0,
      returnPct: summary?.blendedApy ?? 0,
      positionCount: summary?.positionCount ?? 0,
      dailyYield: summary?.dailyYield ?? 0,
      monthlyYield: summary?.monthlyYield ?? 0,
    };
  });
}

export function buildLiveInvestmentHighlights(
  templateHighlights: Array<Record<string, unknown>>,
  summaries: SleeveAllocationSummary[],
) {
  const totalDeployed = summaries.reduce((sum, item) => sum + item.principal, 0);
  const blendedApy = getBlendedContractApy();
  const monthlyYield = summaries.reduce((sum, item) => sum + item.monthlyYield, 0);
  const activeSleeves = summaries.filter((item) => item.positionCount > 0).length;

  const currentById: Record<string, number> = {
    deployed: totalDeployed,
    yield: blendedApy,
    income: monthlyYield,
    diversification: activeSleeves,
  };

  return templateHighlights.map((item) => ({
    ...item,
    current: currentById[item.id as string] ?? 0,
    previous: 0,
  }));
}

export function buildSleeveYieldHistory(
  sleeveKey: AllocationSleeveKey,
  interval: YieldTrendInterval,
  positions: AllocationPosition[] = getActiveAllocationPositions(),
) {
  const today = formatEasternIsoDate();
  const fromYmd = getIntervalStartYmd(interval, today);
  const sleevePositions = getSleevePositionsForKey(sleeveKey, positions);
  const logEntries = getAllocationYieldLogEntries().filter((entry) => entry.sleeveKey === sleeveKey);

  const daily = buildDailyYieldTrendSeries(
    sleeveKey,
    sleevePositions,
    logEntries,
    fromYmd,
    today,
    interval,
  );

  return sampleYieldTrendPoints(daily, interval, today);
}

export interface CombinedYieldTrendPoint {
  label: string;
  treasury: number;
  bonds: number;
  stocks: number;
}

function resolveSleeveReturnAtYmd(
  series: YieldTrendPoint[],
  ymd: string,
  baselineYmd: string | null,
): number {
  if (baselineYmd && ymd < baselineYmd) return 0;

  const exact = series.find((point) => point.ymd === ymd);
  if (exact) return exact.apy;

  const prior = series.filter((point) => point.ymd <= ymd).pop();
  return prior?.apy ?? 0;
}

export function buildCombinedYieldTrendHistory(
  interval: YieldTrendInterval,
  positions: AllocationPosition[] = getActiveAllocationPositions(),
): CombinedYieldTrendPoint[] {
  const today = formatEasternIsoDate();
  const fromYmd = getIntervalStartYmd(interval, today);

  const dailyBySleeve = Object.fromEntries(
    ALLOCATION_SLEEVE_KEYS.map((sleeveKey) => {
      const sleevePositions = getSleevePositionsForKey(sleeveKey, positions);
      const logEntries = getAllocationYieldLogEntries().filter(
        (entry) => entry.sleeveKey === sleeveKey,
      );
      return [
        sleeveKey,
        buildDailyYieldTrendSeries(
          sleeveKey,
          sleevePositions,
          logEntries,
          fromYmd,
          today,
          interval,
        ),
      ];
    }),
  ) as Record<AllocationSleeveKey, YieldTrendPoint[]>;

  const baselines = Object.fromEntries(
    ALLOCATION_SLEEVE_KEYS.map((sleeveKey) => {
      const firstPurchase = getFirstPurchaseYmd(getSleevePositionsForKey(sleeveKey, positions));
      return [sleeveKey, firstPurchase ? addEasternDays(firstPurchase, -1) : null];
    }),
  ) as Record<AllocationSleeveKey, string | null>;

  const allYmds = [
    ...new Set(ALLOCATION_SLEEVE_KEYS.flatMap((key) => dailyBySleeve[key].map((point) => point.ymd))),
  ].sort();

  const mergedDaily: CombinedYieldTrendPoint[] = allYmds.map((ymd) => ({
    label: formatYieldTrendLabel(ymd, interval, ymd === today),
    treasury: resolveSleeveReturnAtYmd(dailyBySleeve.treasury, ymd, baselines.treasury),
    bonds: resolveSleeveReturnAtYmd(dailyBySleeve.bonds, ymd, baselines.bonds),
    stocks: resolveSleeveReturnAtYmd(dailyBySleeve.stocks, ymd, baselines.stocks),
  }));

  if (interval === "1d") {
    return mergedDaily.slice(-7).map((point, index, arr) => ({
      ...point,
      label: index === arr.length - 1 ? "Now" : point.label,
    }));
  }

  const pointCount = getYieldTrendPointCount(interval);
  if (mergedDaily.length <= pointCount) {
    return mergedDaily.map((point, index, arr) => ({
      ...point,
      label: index === arr.length - 1 ? "Now" : point.label,
    }));
  }

  const bucketSize = Math.max(1, Math.ceil(mergedDaily.length / pointCount));
  const buckets: CombinedYieldTrendPoint[] = [];

  for (let index = 0; index < mergedDaily.length; index += bucketSize) {
    buckets.push(mergedDaily[Math.min(index + bucketSize - 1, mergedDaily.length - 1)]);
  }

  if (buckets.length) {
    buckets[buckets.length - 1] = {
      ...mergedDaily[mergedDaily.length - 1],
      label: "Now",
    };
  }

  return buckets.map((point) => ({
    label: point.label,
    treasury: Number(point.treasury.toFixed(2)),
    bonds: Number(point.bonds.toFixed(2)),
    stocks: Number(point.stocks.toFixed(2)),
  }));
}

const MEMBER_ACCOUNTS_RECORD_PREFIX = "member-accounts-";

export interface EscrowLedgerEntry {
  id: string;
  label: string;
  amount: number;
  type: "inflow" | "outflow";
  createdAt: string;
}

export function getEscrowLedgerEntries(limit = 24): EscrowLedgerEntry[] {
  const entries: EscrowLedgerEntry[] = [];

  getAllocationYieldLogEntries(limit * 2).forEach((entry) => {
    const sign = entry.amount >= 0 ? "+" : "";
    entries.push({
      id: entry.id,
      label: `${entry.contractLabel} · ${sign}${entry.returnPct.toFixed(3)}% daily · ${entry.dayYmd}`,
      amount: Math.abs(entry.amount),
      type: entry.amount >= 0 ? "inflow" : "outflow",
      createdAt: entry.createdAt,
    });
  });

  readDataBin("settings")
    .records.filter((record) => record.id.startsWith(MEMBER_ACCOUNTS_RECORD_PREFIX))
    .forEach((record) => {
      const transactions = Array.isArray(record.payload?.transactions)
        ? (record.payload.transactions as MemberAccountTransaction[])
        : [];

      transactions
        .filter((transaction) => transaction.accountId === "escrow")
        .forEach((transaction) => {
          if (!transaction?.id || !Number.isFinite(transaction.amount)) return;
          entries.push({
            id: transaction.id,
            label: transaction.memo?.trim() || "Escrow movement",
            amount: transaction.amount,
            type: transaction.direction === "credit" ? "inflow" : "outflow",
            createdAt: typeof transaction.createdAt === "string" ? transaction.createdAt : "",
          });
        });
    });

  return entries
    .filter((entry) => entry.createdAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Stable snapshot for useSyncExternalStore — must not return a new array reference when data is unchanged. */
let escrowLedgerSnapshot: EscrowLedgerEntry[] = [];
let escrowLedgerSnapshotKey = "";

function getEscrowLedgerSnapshot(limit = 24): EscrowLedgerEntry[] {
  const next = getEscrowLedgerEntries(limit);
  const key = next.map((entry) => `${entry.id}|${entry.amount}|${entry.createdAt}|${entry.type}`).join("\n");
  if (key === escrowLedgerSnapshotKey) return escrowLedgerSnapshot;
  escrowLedgerSnapshotKey = key;
  escrowLedgerSnapshot = next;
  return escrowLedgerSnapshot;
}

export function getPositionsForSleeve(
  sleeveKey: AllocationSleeveKey,
  positions: AllocationPosition[] = getActiveAllocationPositions(),
) {
  return positions
    .filter((position) => position.sleeveKey === sleeveKey && !position.matured)
    .sort((a, b) => b.purchasedDate.localeCompare(a.purchasedDate));
}

export function formatPositionMaturity(dateYmd: string): string {
  return formatEasternShortDate(`${dateYmd}T12:00:00.000Z`);
}

export function useLiveInvestmentFunnel(localizedFunnel: Array<Record<string, unknown>>) {
  const positions = useAllocationPositions();

  return useMemo(() => {
    const summaries = summarizeSleeveAllocations(positions);
    return localizedFunnel.map((item) => {
      const summary = summaries.find((entry) => entry.sleeveKey === item.key);
      return {
        ...item,
        percent: summary?.percent ?? 0,
        allocated: summary?.principal ?? 0,
        returnPct: summary?.blendedApy ?? 0,
      };
    });
  }, [localizedFunnel, positions]);
}

export function useLiveSleeveInvestments(localizedInvestments: Array<Record<string, unknown>>) {
  const positions = useAllocationPositions();

  return useMemo(() => {
    const summaries = summarizeSleeveAllocations(positions);
    return mergeLocalizedSleeveInvestments(localizedInvestments, summaries);
  }, [localizedInvestments, positions]);
}

export function subscribeAllocationSleeves(listener: () => void): () => void {
  return subscribeAllocationPositions(listener);
}

export function getYieldTrendRevision(): string {
  const settings = readDataBin("settings");
  const positionSummary = getActiveAllocationPositions()
    .map((position) =>
      [
        position.id,
        position.sleeveKey,
        position.matured ? "1" : "0",
        position.principal,
        position.contracts,
        position.marketPrice ?? "",
        position.purchasedDate,
      ].join(":"),
    )
    .join("|");
  const logSummary = getAllocationYieldLogEntries()
    .map((entry) => `${entry.id}:${entry.returnPct}:${entry.amount}:${entry.principalAfter}`)
    .join("|");
  return `${settings.updatedAt}|${positionSummary}|${logSummary}|${formatEasternIsoDate()}`;
}

export function subscribeYieldTrend(listener: () => void): () => void {
  const unsubDb = subscribeInternalDatabase(listener);
  const unsubPositions = subscribeAllocationPositions(listener);
  return () => {
    unsubDb();
    unsubPositions();
  };
}

export function useEscrowLedgerEntries(limit = 24): EscrowLedgerEntry[] {
  return useSyncExternalStore(
    (listener) => subscribeInternalDatabase(listener),
    () => getEscrowLedgerSnapshot(limit),
    () => getEscrowLedgerSnapshot(limit),
  );
}
