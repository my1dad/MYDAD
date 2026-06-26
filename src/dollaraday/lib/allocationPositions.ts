import { useSyncExternalStore } from "react";
import {
  addEasternDays,
  easternNow,
  formatEasternIsoDate,
} from "./dateTime";
import {
  computeDailyYieldAmount,
  findAllocationContractTerm,
  getContractTermDays,
  type AllocationContractTerm,
} from "./allocationInstruments";
import type { AllocationSleeveKey } from "./allocationPurchases";
import { readDataBin, subscribeInternalDatabase, upsertDataRecord } from "./internalDatabase";
import { syncAllocationPoolMetrics } from "./allocationApy";
import { appendAllocationYieldLogEntry } from "./allocationYieldLog";
import { getPositionAllocatedValue, getPositionRoi } from "./allocationRoi";

export interface AllocationPosition {
  id: string;
  profileId: string;
  sleeveKey: AllocationSleeveKey;
  contractId: string;
  contractLabel: string;
  principal: number;
  contracts: number;
  annualYieldPct: number;
  purchasedDate: string;
  maturityDate: string;
  lastAccruedDate: string;
  matured: boolean;
  createdAt: string;
  /** Stock: per-share cost at purchase. */
  entryPrice?: number;
  /** Stock: last synced Massive quote. */
  marketPrice?: number;
  /** Market symbol (stocks sleeve). */
  marketSymbol?: string;
}

interface AllocationPositionsPayload {
  positions: AllocationPosition[];
}

export const ALLOCATION_POSITIONS_ID = "allocation-positions";
const EMPTY_POSITIONS: AllocationPosition[] = [];

const listeners = new Set<() => void>();

/** Stable snapshots for useSyncExternalStore. */
const positionsSnapshotCache = new Map<string, { key: string; value: AllocationPosition[] }>();

function positionFingerprint(positions: AllocationPosition[]): string {
  return positions
    .map((position) =>
      [
        position.id,
        position.matured ? "1" : "0",
        position.principal,
        position.contracts,
        position.marketPrice ?? "",
        position.lastAccruedDate,
        position.entryPrice ?? "",
      ].join(":"),
    )
    .join("|");
}

function invalidatePositionsSnapshotCache(): void {
  positionsSnapshotCache.clear();
}

function getAllocationPositionsSnapshot(profileId?: string): AllocationPosition[] {
  const { positions } = readPayload();
  const filtered = profileId
    ? positions.filter((position) => position.profileId === profileId)
    : positions;
  const cacheKey = profileId ?? "__all__";
  const fingerprint = positionFingerprint(filtered);
  const cached = positionsSnapshotCache.get(cacheKey);
  if (cached?.key === fingerprint) return cached.value;

  const snapshot = filtered.slice();
  positionsSnapshotCache.set(cacheKey, { key: fingerprint, value: snapshot });
  return snapshot;
}

function notifyListeners(): void {
  invalidatePositionsSnapshotCache();
  listeners.forEach((listener) => listener());
}

function normalizeStoredPosition(position: AllocationPosition): AllocationPosition {
  if ((position.sleeveKey as string) === "etfs") {
    return { ...position, sleeveKey: "stocks" };
  }
  return position;
}

function readPayload(): AllocationPositionsPayload {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === ALLOCATION_POSITIONS_ID);
  const payload = record?.payload as Partial<AllocationPositionsPayload> | undefined;
  const positions = Array.isArray(payload?.positions)
    ? payload.positions.map(normalizeStoredPosition)
    : EMPTY_POSITIONS;
  return { positions };
}

function writePayload(payload: AllocationPositionsPayload): void {
  upsertDataRecord("settings", ALLOCATION_POSITIONS_ID, "allocation-positions", {
    positions: payload.positions,
  });
  notifyListeners();
  syncAllocationPoolMetrics();
}

function buildMaturityDate(purchasedDate: string, term: AllocationContractTerm): string {
  return addEasternDays(purchasedDate, getContractTermDays(term));
}

export function registerAllocationPosition(input: {
  profileId: string;
  sleeveKey: AllocationSleeveKey;
  contractId: string;
  contractLabel: string;
  principal: number;
  contracts: number;
  purchasedDate?: string;
}): AllocationPosition | null {
  const term = findAllocationContractTerm(input.contractId);
  if (!term || !Number.isFinite(input.principal) || input.principal <= 0) return null;

  const purchasedDate = input.purchasedDate ?? formatEasternIsoDate();
  const position: AllocationPosition = {
    id: `alloc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId: input.profileId,
    sleeveKey: input.sleeveKey,
    contractId: input.contractId,
    contractLabel: input.contractLabel,
    principal: input.principal,
    contracts: input.contracts,
    annualYieldPct: term.annualYieldPct,
    purchasedDate,
    maturityDate: buildMaturityDate(purchasedDate, term),
    lastAccruedDate: purchasedDate,
    matured: false,
    createdAt: easternNow().toISOString(),
  };

  const payload = readPayload();
  writePayload({ positions: [position, ...payload.positions] });

  appendAllocationYieldLogEntry({
    positionId: position.id,
    profileId: position.profileId,
    sleeveKey: position.sleeveKey,
    contractLabel: position.contractLabel,
    dayYmd: purchasedDate,
    returnPct: 0,
    amount: 0,
    principalBefore: position.principal,
    principalAfter: position.principal,
  });

  return position;
}

export function getAllocationPositions(profileId?: string): AllocationPosition[] {
  return getAllocationPositionsSnapshot(profileId);
}

export function getActiveAllocationPositions(): AllocationPosition[] {
  return readPayload().positions.filter((position) => !position.matured);
}

export function getActiveStockPositions(profileId?: string): AllocationPosition[] {
  return getActiveAllocationPositions().filter(
    (position) =>
      position.sleeveKey === "stocks" &&
      (!profileId || position.profileId === profileId),
  );
}

export function appendAllocationPosition(position: AllocationPosition): AllocationPosition {
  const payload = readPayload();
  writePayload({ positions: [position, ...payload.positions] });
  return position;
}

export function closeAllocationPosition(positionId: string): AllocationPosition | null {
  return updateAllocationPosition(positionId, { matured: true });
}

export function patchAllocationPosition(
  positionId: string,
  patch: Partial<
    Pick<
      AllocationPosition,
      "lastAccruedDate" | "matured" | "marketPrice" | "principal" | "contracts" | "entryPrice"
    >
  >,
): AllocationPosition | null {
  const payload = readPayload();
  let updated: AllocationPosition | null = null;

  const positions = payload.positions.map((position) => {
    if (position.id !== positionId) return position;
    const unchanged = (Object.keys(patch) as Array<keyof typeof patch>).every(
      (field) => position[field as keyof AllocationPosition] === patch[field],
    );
    if (unchanged) {
      updated = position;
      return position;
    }
    updated = { ...position, ...patch };
    return updated;
  });

  if (!updated) return null;
  if (updated === payload.positions.find((position) => position.id === positionId)) {
    return updated;
  }

  writePayload({ positions });
  return updated;
}

export function syncStockMarketPricesInStore(
  quotes: Record<string, { price: number }>,
): number {
  const payload = readPayload();
  const today = formatEasternIsoDate();
  let updatedCount = 0;
  let changed = false;

  const positions = payload.positions.map((position) => {
    if (position.sleeveKey !== "stocks" || position.matured) return position;

    const symbol = (position.marketSymbol ?? position.contractId).toUpperCase();
    const quote = quotes[symbol];
    if (!quote || !Number.isFinite(quote.price)) return position;

    const nextPrice = Math.round(quote.price * 100) / 100;
    if (position.marketPrice === nextPrice) return position;

    changed = true;
    updatedCount += 1;
    return { ...position, marketPrice: nextPrice };
  });

  const activeStocks = positions.filter(
    (position) =>
      position.sleeveKey === "stocks" &&
      !position.matured &&
      position.purchasedDate <= today,
  );

  activeStocks.forEach((position) => {
    const roi = getPositionRoi(position);
    appendAllocationYieldLogEntry({
      positionId: position.id,
      profileId: position.profileId,
      sleeveKey: "stocks",
      contractLabel: position.contractLabel,
      dayYmd: today,
      returnPct: roi.pct,
      amount: roi.amount,
      principalBefore: position.principal,
      principalAfter: getPositionAllocatedValue(position),
    });
  });

  if (changed) {
    writePayload({ positions });
  }

  return updatedCount;
}

export function updateAllocationPosition(
  positionId: string,
  patch: Partial<Pick<AllocationPosition, "lastAccruedDate" | "matured">>,
): AllocationPosition | null {
  const payload = readPayload();
  let updated: AllocationPosition | null = null;

  const positions = payload.positions.map((position) => {
    if (position.id !== positionId) return position;
    updated = { ...position, ...patch };
    return updated;
  });

  if (!updated) return null;
  writePayload({ positions });
  return updated;
}

export function previewDailyYieldForPosition(position: AllocationPosition): number {
  return computeDailyYieldAmount(position.principal, position.annualYieldPct);
}

export function subscribeAllocationPositions(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeDb = subscribeInternalDatabase(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeDb();
  };
}

export function useAllocationPositions(profileId?: string): AllocationPosition[] {
  return useSyncExternalStore(
    subscribeAllocationPositions,
    () => getAllocationPositionsSnapshot(profileId),
    () => getAllocationPositionsSnapshot(profileId),
  );
}
