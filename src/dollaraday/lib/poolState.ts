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
  formatEasternTime,
} from "./dateTime";
import { buildEasternPoolSeed } from "./easternSeedData";
import { getTotalMemberEscrowBalance } from "./memberEscrowTotals";

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
      lastUpdatedAt: new Date(now.getTime() - 2 * 60_000).toISOString(),
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

function notifyPoolListeners(): void {
  listeners.forEach((listener) => listener(state));
}

function formatDonationTime(date = easternNow()): string {
  return formatEasternTime(date);
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

  if (escrow) escrow.value = state.poolSummary.escrowBalance;
  if (deployed) deployed.value = state.poolSummary.deployedCapital;
  if (available) available.value = state.poolSummary.availableToDeploy;

  state.poolSummary.reserveRatio =
    state.poolSummary.totalBalance > 0
      ? state.poolSummary.escrowBalance / state.poolSummary.totalBalance
      : 0;
}

function updateComparisonCurrent(comparisonId: string, delta: number): void {
  const item = state.allocationComparisons.find((comparison) => comparison.id === comparisonId);
  if (item) item.current += delta;
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

export function rolloverEasternDayIfNeeded(): boolean {
  const today = formatEasternIsoDate();
  if (state.activeEasternDay === today) return false;

  state.activeEasternDay = today;
  state.todaysDonations = [];
  state.poolSummary.dailyInflow = 0;
  state.dailyAllocationSummary = {
    ...state.dailyAllocationSummary,
    dateLabel: formatEasternLongDate(easternNow()),
    totalDonations: 0,
    totalAmount: 0,
    uniqueContributors: 0,
    pending: 0,
    lastUpdated: "Just now",
    lastUpdatedAt: easternNow().toISOString(),
  };

  persistPoolState();
  notifyPoolListeners();
  return true;
}

export function hydratePoolStateFromStorage(): void {
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
  const totalEscrow = getTotalMemberEscrowBalance();
  const previousEscrow = state.poolSummary.escrowBalance;
  const delta = totalEscrow - previousEscrow;

  if (delta === 0 && state.poolSummary.totalBalance === totalEscrow + state.poolSummary.deployedCapital) {
    return;
  }

  state.poolSummary.escrowBalance = totalEscrow;
  state.poolSummary.availableToDeploy = 0;
  state.poolSummary.totalBalance = totalEscrow + state.poolSummary.deployedCapital;

  if (delta !== 0) {
    bumpBalanceHistory(delta);
  }

  syncCompositionAndReserve();
  persistPoolState();
  notifyPoolListeners();
}

export function resetPoolStateToSeed(): void {
  state = createSeedState();
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

export function registerContribution({
  amount,
  memberId,
  memberName,
  handle,
  includeDailyActivity = true,
  contributedAt,
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

  const timestamp = formatDonationTime(contributedAt ?? easternNow());

  if (includeDailyActivity) {
    const existingDonation = state.todaysDonations.find(
      (donation) => donation.handle === handle || donation.member === memberName
    );

    if (existingDonation) {
      const isSeedRow = /^d-\d{3}$/.test(existingDonation.id);
      existingDonation.amount = isSeedRow ? amount : existingDonation.amount + amount;
      existingDonation.time = timestamp;
      existingDonation.status = "completed";
      state.todaysDonations = [
        existingDonation,
        ...state.todaysDonations.filter((donation) => donation.id !== existingDonation.id),
      ];
    } else {
      state.todaysDonations = [
        {
          id: `d-live-${Date.now()}-${memberId}`,
          member: memberName,
          handle,
          amount,
          time: timestamp,
          status: "completed",
        },
        ...state.todaysDonations,
      ];
      state.dailyAllocationSummary.totalDonations += 1;
      state.dailyAllocationSummary.uniqueContributors += 1;
      updateComparisonCurrent("yesterday", 1);
      updateComparisonCurrent("milestone", 1);
    }

    state.poolSummary.dailyInflow += amount;
    state.dailyAllocationSummary.totalAmount += amount;
    state.dailyAllocationSummary.lastUpdatedAt = easternNow().toISOString();
    state.dailyAllocationSummary.lastUpdated = "Just now";
  }

  state.poolSummary.totalBalance += amount;
  state.poolSummary.escrowBalance += amount;
  state.poolSummary.monthlyInflow += amount;

  bumpBalanceHistory(amount);
  syncCompositionAndReserve();

  updateComparisonCurrent("last-week", amount);
  updateComparisonCurrent("last-month", amount);

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
