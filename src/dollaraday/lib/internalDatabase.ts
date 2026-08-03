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
let databaseRevision = 0;
let bulkWriteDepth = 0;
let bulkWriteDirty = false;

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
    // 423 = FACTORY_ZERO.lock is blocking non-zero restores — treat as intentional no-op.
    if (res.status === 423) return;
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

  // Always keep localStorage in sync so a later disk/cloud hydrate can merge.
  mirrorCacheToLocalStorage(binId);

  if (mode === "local") {
    scheduleNotifyListeners();
    return;
  }

  clearTimeout(pendingWrites[binId]);
  pendingWrites[binId] = setTimeout(() => {
    const nextPayload = cache[binId];
    if (!nextPayload) return;
    persistToDisk(binId, nextPayload)
      .then(() => scheduleNotifyListeners())
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

/**
 * Record-level merge so disk/cloud bootstrap cannot wipe newer local-only records
 * (e.g. allocation-positions created before disk hydrate finishes).
 */
export function mergeDataBinDocuments(
  local: DataBinDocument | null | undefined,
  remote: DataBinDocument | null | undefined,
  key: DataBinKey,
): { merged: DataBinDocument; localWonRecords: boolean } {
  if (!remote?.updatedAt && !local?.updatedAt) {
    return { merged: local ?? remote ?? createEmptyBin(key), localWonRecords: false };
  }
  if (!remote?.updatedAt) {
    return { merged: local!, localWonRecords: true };
  }
  if (!local?.updatedAt) {
    return { merged: normalizeBinDocument(key, remote), localWonRecords: false };
  }

  let epoch: string | null = null;
  try {
    epoch = localStorage.getItem("dollar-a-day-workspace-epoch");
  } catch {
    epoch = null;
  }

  if (epoch && local.updatedAt >= epoch && remote.updatedAt < epoch) {
    return { merged: { ...local, binKey: key }, localWonRecords: true };
  }

  // Intentional factory wipe: a newer empty document must replace history, not merge it back.
  const localEmpty = Array.isArray(local.records) && local.records.length === 0;
  const remoteEmpty = Array.isArray(remote.records) && remote.records.length === 0;
  if (localEmpty && local.updatedAt >= remote.updatedAt) {
    return { merged: { ...local, binKey: key }, localWonRecords: true };
  }
  if (remoteEmpty && remote.updatedAt >= local.updatedAt) {
    return {
      merged: normalizeBinDocument(key, remote),
      localWonRecords: false,
    };
  }

  const byId = new Map<string, StoredRecord>();
  for (const record of remote.records ?? []) {
    if (epoch && (record.updatedAt ?? remote.updatedAt) < epoch) continue;
    byId.set(record.id, record);
  }

  let localWonRecords = false;
  for (const record of local.records ?? []) {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
      localWonRecords = true;
      continue;
    }
    if ((record.updatedAt ?? "") >= (existing.updatedAt ?? "")) {
      if ((record.updatedAt ?? "") > (existing.updatedAt ?? "")) {
        localWonRecords = true;
      }
      byId.set(record.id, record);
    }
  }

  const records = Array.from(byId.values()).sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
  const latestRecordAt = records[0]?.updatedAt ?? "";
  const updatedAt =
    [local.updatedAt, remote.updatedAt, latestRecordAt].sort().at(-1) ?? remote.updatedAt;

  return {
    merged: {
      version: Math.max(local.version ?? 1, remote.version ?? 1),
      binKey: key,
      updatedAt,
      records,
    },
    localWonRecords,
  };
}

function mirrorCacheToLocalStorage(binId: string): void {
  try {
    const payload = cache[binId];
    if (!payload) return;
    localStorage.setItem(localStorageKey(binId), JSON.stringify(payload));
  } catch (err) {
    console.warn(`[internalDatabase] Could not mirror ${binId} to localStorage:`, err);
  }
}

function scheduleNotifyListeners(): void {
  if (bulkWriteDepth > 0) {
    bulkWriteDirty = true;
    return;
  }
  notifyListeners();
}

function notifyListeners(): void {
  databaseRevision += 1;
  invalidateSnapshot();
  const snapshot = getDatabaseSnapshot();
  listeners.forEach((listener) => listener(snapshot));
}

/** Collapse N writes into one React notify — use around registry/cloud bulk sync. */
export function beginBulkWrite(): void {
  bulkWriteDepth += 1;
}

export function endBulkWrite(): void {
  bulkWriteDepth = Math.max(0, bulkWriteDepth - 1);
  if (bulkWriteDepth === 0 && bulkWriteDirty) {
    bulkWriteDirty = false;
    notifyListeners();
  }
}

export function getDatabaseRevision(): number {
  return databaseRevision;
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
  const normalized = normalizeBinDocument(key, document);
  const existing = cache[binId];
  if (
    existing &&
    existing.updatedAt === normalized.updatedAt &&
    existing.records.length === normalized.records.length &&
    JSON.stringify(existing) === JSON.stringify(normalized)
  ) {
    return;
  }

  cache[binId] = normalized;
  try {
    localStorage.setItem(localStorageKey(binId), JSON.stringify(cache[binId]));
  } catch (err) {
    console.warn(`[internalDatabase] Could not cache remote ${binId}:`, err);
  }
  notifyListeners();

  // Remote contributions/settings: invalidate caches only.
  // Full reconcile was freezing the UI — run it later via explicit hydrate({ reconcile: true }).
  if (key === "settings" || key === "contributions") {
    queueMicrotask(() => {
      void Promise.all([
        import("./memberAccounts"),
        import("./poolState"),
      ]).then(([{ invalidateMemberAccountsCache }, { hydratePoolStateFromStorage }]) => {
        invalidateMemberAccountsCache();
        hydratePoolStateFromStorage();
      });
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

function payloadsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (!(key in right)) return false;
    const a = left[key];
    const b = right[key];
    if (a === b) continue;
    // Avoid JSON.stringify on huge values (e.g. photos) unless both are objects.
    if (a && b && typeof a === "object" && typeof b === "object") {
      if (JSON.stringify(a) !== JSON.stringify(b)) return false;
      continue;
    }
    if (a !== b) return false;
  }
  return true;
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
    const nextPayload = { ...existing.payload, ...payload };
    // Skip no-op writes — endless members upserts were freezing Members page re-renders.
    if (payloadsEqual(existing.payload, nextPayload)) {
      return existing;
    }
    const updated: StoredRecord = {
      ...existing,
      source,
      payload: nextPayload,
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
    // Stable for a given revision — hooks should key off bin updatedAt / revision, not a fresh ISO.
    syncedAt: `rev-${databaseRevision}`,
    bins,
  };

  return cachedSnapshot;
}

export async function flushInternalDatabase(): Promise<void> {
  // Cancel debounced writers so a stale payload cannot overwrite this flush.
  for (const binId of Object.keys(pendingWrites)) {
    clearTimeout(pendingWrites[binId]);
    delete pendingWrites[binId];
  }

  const jobs = DAD_BIN_IDS.map((binId) => {
    const payload = cache[binId];
    if (!payload) return Promise.resolve();
    mirrorCacheToLocalStorage(binId);
    return persistToDisk(binId, payload);
  });
  await Promise.all(jobs);
  notifyListeners();
}

/** Synchronously replace a bin in memory + localStorage (disk via flush). */
export function replaceDataBinNow(key: DataBinKey, document: DataBinDocument): void {
  const binId = getBinIdForKey(key);
  cache[binId] = {
    ...document,
    binKey: key,
    version: DATABASE_VERSION,
    updatedAt: document.updatedAt || nowIso(),
  };
  clearTimeout(pendingWrites[binId]);
  delete pendingWrites[binId];
  mirrorCacheToLocalStorage(binId);
}

function clearLocalDadBinKeys(): void {
  try {
    for (const binId of DAD_BIN_IDS) {
      localStorage.removeItem(localStorageKey(binId));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Dev: ask the Vite bins plugin to wipe on-disk workspace + set FACTORY_ZERO.lock
 * so the browser cannot PUT old balances back.
 */
export async function requestFactoryZeroDisk(): Promise<boolean> {
  if (!canUseDiskApi()) return false;
  try {
    const res = await fetchWithTimeout(`/api/bins/factory-zero${binsQueryString()}`, {
      method: "POST",
    }, 5000);
    return res.ok;
  } catch {
    return false;
  }
}

export async function initInternalDatabase(): Promise<DatabaseSnapshot> {
  for (const binId of DAD_BIN_IDS) {
    cache[binId] = null;
  }

  // Instant path: localStorage first so login UI is never blocked on network/disk.
  const loadFromLocal = () => {
    mode = "local";
    binsRoot = null;
    for (const definition of DATA_BIN_DEFINITIONS) {
      cache[definition.binId] = readLocalBin(definition.binId) ?? createEmptyBin(definition.key);
    }
  };

  const applyFactoryZeroFromBootstrap = (bootstrap: Record<string, unknown>) => {
    mode = "disk";
    binsRoot = typeof bootstrap.binsRoot === "string" ? bootstrap.binsRoot : "./bins";
    clearLocalDadBinKeys();
    try {
      localStorage.setItem("dollar-a-day-factory-zero", "1");
      // Drop non-bin app state that can resurrect deposits / recurring / equity.
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith("dollar-a-day")) continue;
        if (key === "dollar-a-day-factory-zero") continue;
        if (key === "dollar-a-day-workspace-epoch") continue;
        if (key === "dollar-a-day-profiles") continue;
        if (key === "dollar-a-day-session") continue;
        if (key === "dollar-a-day-persistent-session") continue;
        localStorage.removeItem(key);
      }
    } catch {
      /* ignore */
    }
    void import("./supabase/cloudSync").then(({ pauseCloudPushes, bumpWorkspaceEpoch }) => {
      bumpWorkspaceEpoch();
      pauseCloudPushes(24 * 60 * 60_000);
    });
    void import("./dadProfileStorage").then(
      ({ findMasterAdminProfile, replaceDadProfilesLocal, setDadSessionId }) => {
        const admin = findMasterAdminProfile();
        if (admin) {
          replaceDadProfilesLocal([admin]);
          setDadSessionId(admin.id);
        }
      },
    );
    for (const definition of DATA_BIN_DEFINITIONS) {
      const diskRaw = bootstrap[definition.binId];
      const diskDoc = diskRaw
        ? normalizeBinDocument(definition.key, diskRaw)
        : createEmptyBin(definition.key);
      cache[definition.binId] = diskDoc;
      mirrorCacheToLocalStorage(definition.binId);
    }
    queueMicrotask(() => {
      void Promise.all([
        import("./memberAccounts"),
        import("./poolState"),
      ]).then(([{ invalidateMemberAccountsCache }, { hydratePoolStateFromStorage }]) => {
        invalidateMemberAccountsCache();
        hydratePoolStateFromStorage();
      });
    });
  };

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
  } else {
    let forcedZero = false;

    // Client-delivery lock: await disk bootstrap first so fat localStorage cannot paint $41k.
    if (import.meta.env.DEV && canUseDiskApi()) {
      try {
        const res = await fetchWithTimeout(`/api/bins/bootstrap${binsQueryString()}`, {}, 2000);
        if (res.ok) {
          const bootstrap = (await res.json()) as Record<string, unknown>;
          if (bootstrap.forceFactoryZero === true) {
            applyFactoryZeroFromBootstrap(bootstrap);
            forcedZero = true;
          } else {
            // Normal path continues below; keep bootstrap for background hydrate.
            loadFromLocal();
            mode = "disk";
            binsRoot = typeof bootstrap.binsRoot === "string" ? bootstrap.binsRoot : "./bins";
            const binsNeedingDiskWrite: string[] = [];
            for (const definition of DATA_BIN_DEFINITIONS) {
              const localDoc =
                cache[definition.binId] ??
                readLocalBin(definition.binId) ??
                createEmptyBin(definition.key);
              const diskRaw = bootstrap[definition.binId];
              const diskDoc = diskRaw
                ? normalizeBinDocument(definition.key, diskRaw)
                : null;
              const { merged, localWonRecords } = mergeDataBinDocuments(
                localDoc,
                diskDoc,
                definition.key,
              );
              cache[definition.binId] = merged;
              mirrorCacheToLocalStorage(definition.binId);
              if (localWonRecords || !diskDoc) {
                binsNeedingDiskWrite.push(definition.binId);
              }
            }
            for (const binId of binsNeedingDiskWrite) {
              schedulePersist(binId);
            }
            forcedZero = true; // skip second hydrate
          }
        }
      } catch {
        // Fall through to localStorage.
      }
    }

    if (!forcedZero) {
      loadFromLocal();

      // Dev disk bins hydrate in the background — never block first paint.
      if (import.meta.env.DEV && canUseDiskApi()) {
        void (async () => {
          try {
            const res = await fetchWithTimeout(`/api/bins/bootstrap${binsQueryString()}`, {}, 1500);
            if (!res.ok) return;
            const bootstrap = (await res.json()) as Record<string, unknown>;
            mode = "disk";
            binsRoot = typeof bootstrap.binsRoot === "string" ? bootstrap.binsRoot : "./bins";

            if (bootstrap.forceFactoryZero === true) {
              applyFactoryZeroFromBootstrap(bootstrap);
              notifyListeners();
              return;
            }

            const binsNeedingDiskWrite: string[] = [];
            for (const definition of DATA_BIN_DEFINITIONS) {
              const localDoc =
                cache[definition.binId] ??
                readLocalBin(definition.binId) ??
                createEmptyBin(definition.key);
              const diskRaw = bootstrap[definition.binId];
              const diskDoc = diskRaw
                ? normalizeBinDocument(definition.key, diskRaw)
                : null;
              const { merged, localWonRecords } = mergeDataBinDocuments(
                localDoc,
                diskDoc,
                definition.key,
              );
              cache[definition.binId] = merged;
              mirrorCacheToLocalStorage(definition.binId);
              if (localWonRecords || !diskDoc) {
                binsNeedingDiskWrite.push(definition.binId);
              }
            }

            notifyListeners();
            for (const binId of binsNeedingDiskWrite) {
              schedulePersist(binId);
            }
          } catch {
            // Keep localStorage mode — silent fallback.
          }
        })();
      }
    }
  }

  initialized = true;
  const snapshot = getDatabaseSnapshot();
  notifyListeners();
  return snapshot;
}

