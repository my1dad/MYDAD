import { useSyncExternalStore } from "react";
import {
  allocationComparisons as seedComparisons,
  currentMember as seedCurrentMember,
  dailyAllocationSummary as seedDailySummary,
  formatPoolCurrency,
  poolComposition as seedComposition,
  poolSummary as seedPoolSummary,
} from "../data/mockData";
import { readDataBin, upsertDataRecord } from "./internalDatabase";
import {
  easternNow,
  formatEasternIsoDate,
  formatEasternLongDate,
} from "./dateTime";
import { buildEasternPoolSeed } from "./easternSeedData";
import { getTotalMemberEscrowBalance } from "./memberEscrowTotals";
import { getTotalDeployedCapital } from "./allocationSleeves";
import { computePoolInflowMetrics } from "./poolInflow";
import { POOL_CAPITAL_COLORS } from "./theme";
import { subscribeInternalDatabase } from "./internalDatabase";

const POOL_STATE_RECORD_ID = "pool-live-state";

export interface TodayDonation {
  id: string;
  member: string;
  handle: string;
  amount: number;
  time: string;
  status: "completed" | "pending" | "failed";
}

export interface CurrentMemberState {
  id: string;
  name: string;
  handle: string;
  avatarInitials: string;
  tier: string;
  memberSince: string;
  dailyContribution: number;
  totalContributed: number;
  equityValue: number;
  streakDays: number;
  loanEligibilityScore: number;
  loanStatus: string;
  nextContributionDue: string;
}

export interface PoolSummaryState {
  totalBalance: number;
  escrowBalance: number;
  availableToDeploy: number;
  deployedCapital: number;
  memberCount: number;
  dailyInflow: number;
  monthlyInflow: number;
  poolApy: number;
  lastAudit: string;
  reserveRatio: number;
  ytdGrowthPct: number;
}

export interface PoolCompositionSegment {
  key: string;
  name: string;
  value: number;
  color: string;
}

export interface AllocationComparison {
  id: string;
  label: string;
  caption: string;
  previous: number;
  current: number;
  format: string;
  target?: number;
}

interface PoolBalancePoint {
  label: string;
  balance: number;
}

interface PoolLiveState {
  poolSummary: PoolSummaryState;
  poolComposition: PoolCompositionSegment[];
  poolBalanceHistory: Record<string, PoolBalancePoint[]>;
  dailyAllocationSummary: {
    dateLabel: string;
    totalDonations: number;
    totalAmount: number;
    uniqueContributors: number;
    pending: number;
    lastUpdated: string;
    lastUpdatedAt: string;
  };
  todaysDonations: TodayDonation[];
  allocationComparisons: AllocationComparison[];
  currentMember: CurrentMemberState;
  activeEasternDay: string;
}

type PoolListener = (state: PoolLiveState) => void;

const listeners = new Set<PoolListener>();

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createSeedState(): PoolLiveState {
  const eastern = buildEasternPoolSeed("en");
  const now = easternNow();

  return {
    poolSummary: {
      ...deepClone(seedPoolSummary),
      lastAudit: eastern.lastAudit,
    },
    poolComposition: deepClone(seedComposition),
    poolBalanceHistory: eastern.poolBalanceHistory,
    dailyAllocationSummary: {
      ...deepClone(seedDailySummary),
      dateLabel: eastern.dateLabel,
      lastUpdated: eastern.lastUpdated,
      lastUpdatedAt: now.toISOString(),
    },
    todaysDonations: eastern.todaysDonations as TodayDonation[],
    allocationComparisons: deepClone(seedComparisons),
    currentMember: {
      ...deepClone(seedCurrentMember),
      nextContributionDue: eastern.nextContributionDue,
    },
    activeEasternDay: formatEasternIsoDate(now),
  };
}

let state: PoolLiveState = createSeedState();
let inflowSyncSubscribed = false;

function ensureInflowSyncSubscription(): void {
  if (inflowSyncSubscribed) return;
  inflowSyncSubscribed = true;
  subscribeInternalDatabase(() => {
    syncPoolInflowMetrics();
    notifyPoolListeners();
  });
}

function notifyPoolListeners(): void {
  listeners.forEach((listener) => listener(state));
}

function bumpBalanceHistory(amount: number): void {
  Object.keys(state.poolBalanceHistory).forEach((interval) => {
    const points = state.poolBalanceHistory[interval];
    if (!points?.length) return;
    points[points.length - 1] = {
      ...points[points.length - 1],
      balance: points[points.length - 1].balance + amount,
    };
  });
}

function syncCompositionAndReserve(): void {
  const escrow = state.poolComposition.find((segment) => segment.key === "escrow");
  const deployed = state.poolComposition.find((segment) => segment.key === "deployed");
  const available = state.poolComposition.find((segment) => segment.key === "available");

  if (escrow) {
    escrow.value = 0;
    escrow.color = POOL_CAPITAL_COLORS.escrow;
  }
  if (deployed) {
    deployed.value = state.poolSummary.deployedCapital;
    deployed.color = POOL_CAPITAL_COLORS.deployed;
  }
  if (available) {
    available.value = state.poolSummary.availableToDeploy;
    available.color = POOL_CAPITAL_COLORS.available;
  }

  state.poolSummary.totalBalance =
    state.poolSummary.deployedCapital +
    state.poolSummary.escrowBalance;

  state.poolSummary.reserveRatio =
    state.poolSummary.totalBalance > 0
      ? state.poolSummary.escrowBalance / state.poolSummary.totalBalance
      : 0;
}

/** Align pool capital with live allocation positions and member escrow balances. */
export function syncPoolCapitalFromLedger(): void {
  const deployed = getTotalDeployedCapital();
  const cashEscrow = getTotalMemberEscrowBalance();

  state.poolSummary.deployedCapital = deployed;
  state.poolSummary.escrowBalance = cashEscrow;
  state.poolSummary.availableToDeploy = cashEscrow;
  syncCompositionAndReserve();
  syncPoolInflowMetrics();
  persistPoolState();
  notifyPoolListeners();
}

function persistPoolState(): void {
  upsertDataRecord("settings", POOL_STATE_RECORD_ID, "pool-state-sync", {
    poolSummary: state.poolSummary,
    poolComposition: state.poolComposition,
    poolBalanceHistory: state.poolBalanceHistory,
    dailyAllocationSummary: state.dailyAllocationSummary,
    todaysDonations: state.todaysDonations,
    allocationComparisons: state.allocationComparisons,
    currentMember: state.currentMember,
    activeEasternDay: state.activeEasternDay,
  });
}

function applyPoolState(payload: Record<string, unknown>): void {
  if (payload.poolSummary && typeof payload.poolSummary === "object") {
    state.poolSummary = payload.poolSummary as PoolSummaryState;
  }
  if (Array.isArray(payload.poolComposition)) {
    state.poolComposition = payload.poolComposition as PoolCompositionSegment[];
  }
  if (payload.poolBalanceHistory && typeof payload.poolBalanceHistory === "object") {
    state.poolBalanceHistory = payload.poolBalanceHistory as Record<string, PoolBalancePoint[]>;
  }
  if (payload.dailyAllocationSummary && typeof payload.dailyAllocationSummary === "object") {
    const summary = payload.dailyAllocationSummary as Partial<PoolLiveState["dailyAllocationSummary"]>;
    state.dailyAllocationSummary = {
      ...state.dailyAllocationSummary,
      ...summary,
      lastUpdatedAt: summary.lastUpdatedAt ?? easternNow().toISOString(),
    };
  }
  if (Array.isArray(payload.todaysDonations)) {
    state.todaysDonations = payload.todaysDonations as TodayDonation[];
  }
  if (Array.isArray(payload.allocationComparisons)) {
    state.allocationComparisons = payload.allocationComparisons as AllocationComparison[];
  }
  if (payload.currentMember && typeof payload.currentMember === "object") {
    state.currentMember = payload.currentMember as CurrentMemberState;
  }
  if (typeof payload.activeEasternDay === "string") {
    state.activeEasternDay = payload.activeEasternDay;
  }
}

/** Recompute daily/monthly inflow, today's donations, and allocation stats from live ledgers. */
export function syncPoolInflowMetrics(): void {
  const metrics = computePoolInflowMetrics(formatEasternIsoDate());

  state.poolSummary.dailyInflow = metrics.dailyInflow;
  state.poolSummary.monthlyInflow = metrics.monthlyInflow;
  state.todaysDonations = metrics.todaysDonations;
  state.dailyAllocationSummary = {
    ...state.dailyAllocationSummary,
    totalDonations: metrics.dailyAllocationSummary.totalDonations,
    totalAmount: metrics.dailyAllocationSummary.totalAmount,
    uniqueContributors: metrics.dailyAllocationSummary.uniqueContributors,
    pending: metrics.dailyAllocationSummary.pending,
    lastUpdatedAt: metrics.dailyAllocationSummary.lastUpdatedAt,
  };

  state.allocationComparisons.forEach((comparison) => {
    const nextCurrent =
      metrics.allocationComparisonCurrent[
        comparison.id as keyof typeof metrics.allocationComparisonCurrent
      ];
    if (nextCurrent !== undefined) {
      comparison.current = nextCurrent;
    }
  });
}

export function rolloverEasternDayIfNeeded(): boolean {
  const today = formatEasternIsoDate();
  if (state.activeEasternDay === today) return false;

  state.activeEasternDay = today;
  state.dailyAllocationSummary = {
    ...state.dailyAllocationSummary,
    dateLabel: formatEasternLongDate(easternNow()),
  };

  syncPoolInflowMetrics();
  persistPoolState();
  notifyPoolListeners();
  return true;
}

export function hydratePoolStateFromStorage(): void {
  ensureInflowSyncSubscription();
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === POOL_STATE_RECORD_ID);
  if (record?.payload) {
    applyPoolState(record.payload);
    notifyPoolListeners();
  }
  syncMemberEscrowToLiquidityPool();
}

/** Align liquidity pool escrow/total with summed member Chase Escrow account balances. */
export function syncMemberEscrowToLiquidityPool(): void {
  syncPoolCapitalFromLedger();
}

export function resetPoolStateToSeed(): void {
  state = createSeedState();
  persistPoolState();
  notifyPoolListeners();
}

export function importPoolLiveState(partial: Partial<PoolLiveState>): void {
  applyPoolState(partial as Record<string, unknown>);
  persistPoolState();
  notifyPoolListeners();
}

export function activateMemberSession(member: CurrentMemberState): void {
  state.currentMember = member;
  persistPoolState();
  notifyPoolListeners();
}

export function registerNewPoolMember(member: CurrentMemberState): void {
  state.poolSummary.memberCount += 1;
  state.currentMember = member;
  persistPoolState();
  notifyPoolListeners();
}

export function getPoolState(): PoolLiveState {
  return state;
}

export function getDashboardStats() {
  return {
    escrow: {
      label: "Escrow Balance",
      value: formatPoolCurrency(state.poolSummary.escrowBalance),
    },
    daily: {
      label: "Daily Contributions",
      value: formatPoolCurrency(state.poolSummary.dailyInflow),
    },
    apy: {
      label: "Pool APY",
      value: `${state.poolSummary.poolApy}%`,
    },
  };
}

export function increaseDeployedCapital(_amount: number): void {
  syncPoolCapitalFromLedger();
}

export function decreaseDeployedCapital(_amount: number): void {
  syncPoolCapitalFromLedger();
}

/** Apply net treasury/bond daily compound P/L to pool balance history. */
export function applyPoolCompoundReturn(netDelta: number): void {
  if (!Number.isFinite(netDelta) || netDelta === 0) return;
  bumpBalanceHistory(netDelta);
  syncPoolCapitalFromLedger();
}

export function setPoolApy(apy: number): void {
  if (!Number.isFinite(apy) || apy < 0) return;
  state.poolSummary.poolApy = Math.round(apy * 100) / 100;
  persistPoolState();
  notifyPoolListeners();
}

export function setPoolYtdGrowthFromYield(pct: number): void {
  if (!Number.isFinite(pct)) return;
  state.poolSummary.ytdGrowthPct = Math.round(pct * 100) / 100;
  persistPoolState();
  notifyPoolListeners();
}

export function registerContribution({
  amount,
  memberId,
}: {
  amount: number;
  reminderEnabled?: boolean;
  recurringEnabled?: boolean;
  memberId: string;
  memberName: string;
  handle: string;
  includeDailyActivity?: boolean;
  contributedAt?: Date;
}): void {
  if (!Number.isFinite(amount) || amount <= 0) return;

  syncPoolInflowMetrics();

  if (state.currentMember.id === memberId) {
    state.currentMember.totalContributed += amount;
    state.currentMember.equityValue += amount;
    state.currentMember.dailyContribution = amount;
  }

  persistPoolState();
  notifyPoolListeners();
}

export function subscribePoolState(listener: PoolListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePoolState(): PoolLiveState & { dashboardStats: ReturnType<typeof getDashboardStats> } {
  const liveState = useSyncExternalStore(subscribePoolState, getPoolState, getPoolState);
  return {
    ...liveState,
    dashboardStats: getDashboardStats(),
  };
}
