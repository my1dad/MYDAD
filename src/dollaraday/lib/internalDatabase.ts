import {
  DAD_BIN_IDS,
  DAD_BIN_PATH_BY_ID,
  DAD_STORAGE_PROFILE_ID,
  DATA_BIN_DEFINITIONS,
  type DataBinKey,
  getBinIdForKey,
} from "./dataBins";

export type { DataBinKey };

export const DATABASE_VERSION = 1;

export type StorageMode = "local" | "disk" | "electron";

export interface StoredRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  payload: Record<string, unknown>;
}

export interface DataBinDocument {
  version: number;
  binKey: DataBinKey;
  updatedAt: string;
  records: StoredRecord[];
}

export interface DatabaseSnapshot {
  profileId: string;
  mode: StorageMode;
  binsRoot: string | null;
  syncedAt: string;
  bins: Record<DataBinKey, DataBinDocument>;
}

type DatabaseListener = (snapshot: DatabaseSnapshot) => void;

const WRITE_DEBOUNCE_MS = 250;
const FETCH_TIMEOUT_MS = 5000;

let mode: StorageMode = "local";
let binsRoot: string | null = null;
let initialized = false;

const cache = Object.create(null) as Record<string, DataBinDocument | null>;
const pendingWrites = Object.create(null) as Record<string, ReturnType<typeof setTimeout>>;
const listeners = new Set<DatabaseListener>();
let cachedSnapshot: DatabaseSnapshot | null = null;

function invalidateSnapshot(): void {
  cachedSnapshot = null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyBin(key: DataBinKey): DataBinDocument {
  return {
    version: DATABASE_VERSION,
    binKey: key,
    updatedAt: nowIso(),
    records: [],
  };
}

function localStorageKey(binId: string): string {
  return `dollar-a-day:${DAD_STORAGE_PROFILE_ID}:${binId}`;
}

function hasElectronBins(): boolean {
  return typeof window !== "undefined" && Boolean(window.overDriveBins?.readJson);
}

function canUseDiskApi(): boolean {
  return typeof fetch !== "undefined";
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function binsQueryString(): string {
  return `?profileId=${encodeURIComponent(DAD_STORAGE_PROFILE_ID)}`;
}

function scopeDiskPath(relativePath: string): string {
  return `profiles/${DAD_STORAGE_PROFILE_ID}/${relativePath}`;
}

async function persistToDisk(binId: string, payload: DataBinDocument): Promise<void> {
  if (mode === "electron" && window.overDriveBins?.writeJson) {
    const relPath = DAD_BIN_PATH_BY_ID[binId];
    if (!relPath) return;
    await window.overDriveBins.writeJson(scopeDiskPath(relPath), payload);
    return;
  }

  if (mode === "disk") {
    const res = await fetchWithTimeout(`/api/bins/${encodeURIComponent(binId)}${binsQueryString()}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to save ${binId}`);
  }
}

function schedulePersist(binId: string): void {
  const payload = cache[binId];
  if (payload) {
    queueMicrotask(() => {
      void import("./supabase/cloudSync").then(({ scheduleCloudBinPush }) => {
        scheduleCloudBinPush(binId, payload);
      });
    });
  }

  if (mode === "local") {
    try {
      localStorage.setItem(localStorageKey(binId), JSON.stringify(cache[binId]));
    } catch (err) {
      console.warn(`[internalDatabase] Could not save ${binId} to localStorage:`, err);
    }
    notifyListeners();
    return;
  }

  clearTimeout(pendingWrites[binId]);
  pendingWrites[binId] = setTimeout(() => {
    const nextPayload = cache[binId];
    if (!nextPayload) return;
    persistToDisk(binId, nextPayload)
      .then(() => notifyListeners())
      .catch((err) => console.warn(`[internalDatabase] Could not persist ${binId}:`, err));
  }, WRITE_DEBOUNCE_MS);
}

function readLocalBin(binId: string): DataBinDocument | null {
  try {
    const raw = localStorage.getItem(localStorageKey(binId));
    if (!raw) return null;
    return JSON.parse(raw) as DataBinDocument;
  } catch {
    return null;
  }
}

function normalizeBinDocument(key: DataBinKey, raw: unknown): DataBinDocument {
  if (!raw || typeof raw !== "object") return createEmptyBin(key);
  const doc = raw as Partial<DataBinDocument>;
  return {
    version: doc.version ?? DATABASE_VERSION,
    binKey: key,
    updatedAt: doc.updatedAt ?? nowIso(),
    records: Array.isArray(doc.records) ? doc.records : [],
  };
}

function notifyListeners(): void {
  invalidateSnapshot();
  const snapshot = getDatabaseSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribeInternalDatabase(listener: DatabaseListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStorageMode(): StorageMode {
  return mode;
}

export function getBinsRoot(): string | null {
  return binsRoot;
}

export function isInternalDatabaseReady(): boolean {
  return initialized;
}

export function readDataBin(key: DataBinKey): DataBinDocument {
  const binId = getBinIdForKey(key);
  return cache[binId] ?? createEmptyBin(key);
}

export function writeDataBin(key: DataBinKey, document: DataBinDocument): void {
  const binId = getBinIdForKey(key);
  cache[binId] = {
    ...document,
    binKey: key,
    version: DATABASE_VERSION,
    updatedAt: nowIso(),
  };
  schedulePersist(binId);
}

export function applyExternalBinDocument(
  binId: string,
  key: DataBinKey,
  document: DataBinDocument,
): void {
  cache[binId] = normalizeBinDocument(key, document);
  try {
    localStorage.setItem(localStorageKey(binId), JSON.stringify(cache[binId]));
  } catch (err) {
    console.warn(`[internalDatabase] Could not cache remote ${binId}:`, err);
  }
  notifyListeners();

  // Remote settings/contributions must refresh member ledgers, member stats, and pool totals.
  if (key === "settings" || key === "contributions" || key === "members") {
    queueMicrotask(() => {
      void Promise.all([
        import("./memberAccounts"),
        import("./poolState"),
        import("./memberRegistry"),
      ]).then(
        ([
          { invalidateMemberAccountsCache },
          { hydratePoolStateFromStorage },
          { reconcileMembersFromContributions },
        ]) => {
          invalidateMemberAccountsCache();
          if (key === "contributions") {
            reconcileMembersFromContributions();
          }
          hydratePoolStateFromStorage();
        },
      );
    });
  }
}

export function appendDataRecord(
  key: DataBinKey,
  source: string,
  payload: Record<string, unknown>
): StoredRecord {
  const bin = readDataBin(key);
  const timestamp = nowIso();
  const record: StoredRecord = {
    id: createId(key),
    createdAt: timestamp,
    updatedAt: timestamp,
    source,
    payload,
  };

  writeDataBin(key, {
    ...bin,
    records: [record, ...bin.records],
  });

  return record;
}

export function upsertDataRecord(
  key: DataBinKey,
  recordId: string,
  source: string,
  payload: Record<string, unknown>
): StoredRecord {
  const bin = readDataBin(key);
  const timestamp = nowIso();
  const existing = bin.records.find((item) => item.id === recordId);

  if (existing) {
    const updated: StoredRecord = {
      ...existing,
      source,
      payload: { ...existing.payload, ...payload },
      updatedAt: timestamp,
    };
    writeDataBin(key, {
      ...bin,
      records: bin.records.map((item) => (item.id === recordId ? updated : item)),
    });
    return updated;
  }

  const created: StoredRecord = {
    id: recordId,
    createdAt: timestamp,
    updatedAt: timestamp,
    source,
    payload,
  };
  writeDataBin(key, {
    ...bin,
    records: [created, ...bin.records],
  });
  return created;
}

export function removeDataRecord(key: DataBinKey, recordId: string): boolean {
  const bin = readDataBin(key);
  const nextRecords = bin.records.filter((item) => item.id !== recordId);
  if (nextRecords.length === bin.records.length) return false;

  writeDataBin(key, {
    ...bin,
    records: nextRecords,
  });
  return true;
}

export function removeDataRecordsByPayload(
  key: DataBinKey,
  predicate: (payload: Record<string, unknown>) => boolean,
): number {
  const bin = readDataBin(key);
  const nextRecords = bin.records.filter((item) => !predicate(item.payload));
  const removed = bin.records.length - nextRecords.length;
  if (!removed) return 0;

  writeDataBin(key, {
    ...bin,
    records: nextRecords,
  });
  return removed;
}

export function clearDataBin(key: DataBinKey): void {
  writeDataBin(key, createEmptyBin(key));
}

export function getDatabaseSnapshot(): DatabaseSnapshot {
  if (cachedSnapshot) return cachedSnapshot;

  const bins = Object.create(null) as Record<DataBinKey, DataBinDocument>;
  for (const definition of DATA_BIN_DEFINITIONS) {
    bins[definition.key] = readDataBin(definition.key);
  }

  cachedSnapshot = {
    profileId: DAD_STORAGE_PROFILE_ID,
    mode,
    binsRoot,
    syncedAt: nowIso(),
    bins,
  };

  return cachedSnapshot;
}

export async function flushInternalDatabase(): Promise<void> {
  const jobs = DAD_BIN_IDS.map((binId) => {
    const payload = cache[binId];
    return payload ? persistToDisk(binId, payload) : Promise.resolve();
  });
  await Promise.all(jobs);
  notifyListeners();
}

export async function initInternalDatabase(): Promise<DatabaseSnapshot> {
  for (const binId of DAD_BIN_IDS) {
    cache[binId] = null;
  }

  if (hasElectronBins()) {
    mode = "electron";
    binsRoot = (await window.overDriveBins?.getRoot?.()) ?? null;
    const all = (await window.overDriveBins?.loadAll?.(DAD_STORAGE_PROFILE_ID)) ?? {};
    for (const definition of DATA_BIN_DEFINITIONS) {
      cache[definition.binId] = normalizeBinDocument(
        definition.key,
        all[definition.binId] ?? readLocalBin(definition.binId)
      );
    }
  } else if (import.meta.env.DEV && canUseDiskApi()) {
    try {
      const res = await fetchWithTimeout(`/api/bins/bootstrap${binsQueryString()}`);
      if (!res.ok) throw new Error(`Bootstrap failed (${res.status})`);
      const bootstrap = (await res.json()) as Record<string, unknown>;
      mode = "disk";
      binsRoot = typeof bootstrap.binsRoot === "string" ? bootstrap.binsRoot : "./bins";
      for (const definition of DATA_BIN_DEFINITIONS) {
        cache[definition.binId] = normalizeBinDocument(
          definition.key,
          bootstrap[definition.binId] ?? readLocalBin(definition.binId)
        );
      }
    } catch (err) {
      console.warn("[internalDatabase] Disk bins unavailable, using localStorage:", err);
      mode = "local";
      binsRoot = null;
      for (const definition of DATA_BIN_DEFINITIONS) {
        cache[definition.binId] =
          readLocalBin(definition.binId) ?? createEmptyBin(definition.key);
      }
    }
  } else {
    mode = "local";
    binsRoot = null;
    for (const definition of DATA_BIN_DEFINITIONS) {
      cache[definition.binId] = readLocalBin(definition.binId) ?? createEmptyBin(definition.key);
    }
  }

  initialized = true;
  const snapshot = getDatabaseSnapshot();
  notifyListeners();
  return snapshot;
}

