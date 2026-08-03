import type { RealtimeChannel } from "@supabase/supabase-js";
import { isAdminProfile } from "../../../config/admin";
import { DAD_BIN_IDS, DAD_STORAGE_PROFILE_ID, DATA_BIN_DEFINITIONS, type DataBinKey } from "../dataBins";
import type { DadProfile } from "../dadProfileStorage";
import {
  applyExternalBinDocument,
  readDataBin,
  type DataBinDocument,
} from "../internalDatabase";
import { DAD_WORKSPACE_ID, getSupabaseClient, isSupabaseConfigured } from "./client";

const CLOUD_PUSH_DEBOUNCE_MS = 2500;
const CLOUD_POLL_MS = 10 * 60_000;
const CLOUD_VISIBLE_RESYNC_MIN_MS = 5 * 60_000;
const GLOBAL_KV_SCOPE = "global";

/** Marks a factory reset so sync cannot resurrect wiped members/data. */
export const WORKSPACE_EPOCH_KEY = "dollar-a-day-workspace-epoch";

let lastFullSyncAt = 0;
let cloudPushPausedUntil = 0;

/** Pause outbound cloud pushes during the interactive window after login. */
export function pauseCloudPushes(ms = 15_000): void {
  cloudPushPausedUntil = Date.now() + Math.max(0, ms);
}

function cloudPushesAllowed(): boolean {
  return Date.now() >= cloudPushPausedUntil;
}

/** localStorage keys synced to dad_kv (excluding profiles & session keys). */
export const SYNCED_KV_KEYS = [
  "dollar-a-day-app-settings",
  "dollar-a-day-notification-read",
  "dollar-a-day-notification-dismissed",
  "dollar-a-day-dm-read",
  "dda-locale",
  WORKSPACE_EPOCH_KEY,
] as const;

export function bumpWorkspaceEpoch(): string {
  const epoch = new Date().toISOString();
  try {
    localStorage.setItem(WORKSPACE_EPOCH_KEY, epoch);
  } catch {
    /* ignore quota */
  }
  return epoch;
}

export function getWorkspaceEpoch(): string | null {
  try {
    return localStorage.getItem(WORKSPACE_EPOCH_KEY);
  } catch {
    return null;
  }
}

function parseEpochValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^"|"$/g, "");
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return parseEpochValue(JSON.stringify(value));
  } catch {
    return null;
  }
}

function getRemoteWorkspaceEpoch(rows: CloudKvRow[]): string | null {
  const remote = rows.find(
    (row) => row.scope_key === GLOBAL_KV_SCOPE && row.kv_key === WORKSPACE_EPOCH_KEY,
  );
  if (!remote) return null;
  return parseEpochValue(remote.value);
}

/** True when cloud published a newer factory wipe than this device. */
function isCloudFactoryWipeAuthoritative(remoteKv: CloudKvRow[]): boolean {
  const remoteEpoch = getRemoteWorkspaceEpoch(remoteKv);
  if (!remoteEpoch) return false;
  const localEpoch = getWorkspaceEpoch();
  return !localEpoch || remoteEpoch > localEpoch;
}

function isAdminOnlyDirectory(profiles: DadProfile[]): boolean {
  return profiles.length === 1 && isAdminProfile(profiles[0]);
}

/** After master reset, never merge remote members back on top of the admin-only directory. */
function shouldHonorFactoryResetDirectory(localProfiles: DadProfile[]): boolean {
  return Boolean(getWorkspaceEpoch()) && isAdminOnlyDirectory(localProfiles);
}

function isFactoryZeroLockedLocally(): boolean {
  try {
    return localStorage.getItem("dollar-a-day-factory-zero") === "1";
  } catch {
    return false;
  }
}

type SyncedKvKey = (typeof SYNCED_KV_KEYS)[number];

interface CloudBinRow {
  bin_id: string;
  document: DataBinDocument;
  updated_at: string;
}

interface CloudProfileRow {
  id: string;
  username: string;
  password: string;
  display_name: string;
  full_name: string | null;
  role: string | null;
  pro_id: string | null;
  email: string | null;
  phone: string | null;
  profile_photo_url: string | null;
  referred_by_pro_id: string | null;
  account_status: string | null;
  approval_status: string | null;
  created_at: string;
  last_login_at: string;
  updated_at: string;
}

interface CloudKvRow {
  scope_key: string;
  kv_key: string;
  value: unknown;
  updated_at: string;
}

const pendingBinPushes = new Map<string, ReturnType<typeof setTimeout>>();
let pendingProfilePush: ReturnType<typeof setTimeout> | null = null;
const pendingKvPushes = new Map<string, ReturnType<typeof setTimeout>>();

let realtimeChannel: RealtimeChannel | null = null;
let cloudInitialized = false;
let lastSyncAt: string | null = null;
let lastSyncError: string | null = null;
let statusListeners = new Set<() => void>();
let statusRevision = 0;

function notifyCloudStatusListeners() {
  statusRevision += 1;
  statusListeners.forEach((listener) => listener());
}

export function subscribeCloudSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function getCloudSyncStatusRevision(): number {
  return statusRevision;
}

export function getCloudSyncStatus(): {
  configured: boolean;
  ready: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  workspaceId: string;
} {
  return {
    configured: isSupabaseConfigured(),
    ready: cloudInitialized && isSupabaseConfigured(),
    lastSyncAt,
    lastError: lastSyncError,
    workspaceId: DAD_WORKSPACE_ID,
  };
}

function binKeyForBinId(binId: string): DataBinKey | null {
  const definition = DATA_BIN_DEFINITIONS.find((item) => item.binId === binId);
  return definition?.key ?? null;
}

function profileToRow(profile: DadProfile) {
  return {
    id: profile.id,
    username: profile.username,
    password: profile.password,
    display_name: profile.displayName,
    full_name: profile.fullName ?? null,
    role: profile.role ?? null,
    pro_id: profile.proId ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    profile_photo_url: profile.profilePhotoUrl ?? null,
    referred_by_pro_id: profile.referredByProId ?? null,
    account_status: profile.accountStatus ?? null,
    approval_status: profile.approvalStatus ?? null,
    created_at: profile.createdAt,
    last_login_at: profile.lastLoginAt,
    updated_at: profile.updatedAt ?? profile.lastLoginAt ?? profile.createdAt,
  };
}

function rowToProfile(row: CloudProfileRow): DadProfile {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    displayName: row.display_name,
    fullName: row.full_name ?? undefined,
    role: row.role ?? undefined,
    proId: row.pro_id ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    referredByProId: row.referred_by_pro_id ?? undefined,
    accountStatus: (row.account_status as DadProfile["accountStatus"]) ?? undefined,
    approvalStatus: (row.approval_status as DadProfile["approvalStatus"]) ?? undefined,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    updatedAt: row.updated_at,
  };
}

function mergeBinDocuments(
  local: DataBinDocument | null,
  remote: DataBinDocument | null,
): { merged: DataBinDocument; source: "local" | "remote" | "empty" | "merged" } {
  if (!remote?.updatedAt && !local?.updatedAt) {
    return { merged: local ?? remote!, source: "empty" };
  }
  if (!remote?.updatedAt) {
    return { merged: local!, source: "local" };
  }
  if (!local?.updatedAt) {
    return { merged: remote, source: "remote" };
  }

  const epoch = getWorkspaceEpoch();

  // After master reset: local post-wipe bins win over any pre-reset cloud history.
  if (epoch && local.updatedAt >= epoch && remote.updatedAt < epoch) {
    return { merged: local, source: "local" };
  }

  // Master reset / factory wipe: newer empty bin replaces remote history entirely.
  const localEmpty = Array.isArray(local.records) && local.records.length === 0;
  const remoteEmpty = Array.isArray(remote.records) && remote.records.length === 0;
  if (localEmpty && local.updatedAt >= remote.updatedAt) {
    return { merged: local, source: "local" };
  }
  if (remoteEmpty && remote.updatedAt >= local.updatedAt) {
    return { merged: remote, source: "remote" };
  }

  const byId = new Map<string, DataBinDocument["records"][number]>();
  for (const record of remote.records ?? []) {
    // Drop cloud records that predate the factory reset epoch.
    if (epoch && (record.updatedAt ?? remote.updatedAt) < epoch) continue;
    byId.set(record.id, record);
  }

  let localHadExclusiveOrNewer = false;
  for (const record of local.records ?? []) {
    const existing = byId.get(record.id);
    if (!existing) {
      byId.set(record.id, record);
      localHadExclusiveOrNewer = true;
      continue;
    }
    if ((record.updatedAt ?? "") >= (existing.updatedAt ?? "")) {
      if ((record.updatedAt ?? "") > (existing.updatedAt ?? "")) {
        localHadExclusiveOrNewer = true;
      }
      byId.set(record.id, record);
    }
  }

  const records = Array.from(byId.values()).sort((a, b) =>
    String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
  );
  const latestRecordAt = records[0]?.updatedAt ?? "";
  const updatedAt = [local.updatedAt, remote.updatedAt, latestRecordAt].sort().at(-1) ?? remote.updatedAt;

  const merged: DataBinDocument = {
    version: Math.max(local.version ?? 1, remote.version ?? 1),
    binKey: local.binKey ?? remote.binKey,
    updatedAt,
    records,
  };

  if (localHadExclusiveOrNewer) {
    return { merged, source: "merged" };
  }
  if (remote.updatedAt >= local.updatedAt) {
    return { merged, source: "remote" };
  }
  return { merged, source: "local" };
}

function profileTimestamp(profile: DadProfile): string {
  return profile.updatedAt ?? profile.lastLoginAt ?? profile.createdAt ?? "";
}

function preferApprovalStatus(
  winner: DadProfile,
  local: DadProfile,
  remote: DadProfile,
): DadProfile {
  const localStatus = local.approvalStatus;
  const remoteStatus = remote.approvalStatus;
  const winnerStatus = winner.approvalStatus;

  // Approved always beats a stale pending/unknown — never treat missing as approved.
  if (localStatus === "approved" || remoteStatus === "approved") {
    if (winnerStatus !== "denied") {
      return { ...winner, approvalStatus: "approved" };
    }
    // denied vs approved: keep the newer side's decision
    const localTs = profileTimestamp(local);
    const remoteTs = profileTimestamp(remote);
    const decided = localTs >= remoteTs ? localStatus : remoteStatus;
    return { ...winner, approvalStatus: decided ?? winnerStatus };
  }

  if (
    (localStatus === "denied" || remoteStatus === "denied") &&
    (winnerStatus === "pending" || winnerStatus == null)
  ) {
    return { ...winner, approvalStatus: "denied" };
  }

  return winner;
}

function mergeProfiles(local: DadProfile[], remote: DadProfile[]): DadProfile[] {
  const epoch = getWorkspaceEpoch();
  const remoteUsable = epoch
    ? remote.filter(
        (profile) =>
          isAdminProfile(profile) || profileTimestamp(profile) >= epoch,
      )
    : remote;

  const map = new Map<string, DadProfile>();
  for (const profile of remoteUsable) map.set(profile.id, profile);
  for (const profile of local) {
    const existing = map.get(profile.id);
    if (!existing) {
      map.set(profile.id, profile);
      continue;
    }

    const localTs = profileTimestamp(profile);
    const remoteTs = profileTimestamp(existing);
    // Cloud wins ties so devices that registered locally pick up admin approval.
    const winner = localTs > remoteTs ? profile : existing;
    map.set(profile.id, preferApprovalStatus(winner, profile, existing));
  }
  return Array.from(map.values());
}

/** Profiles whose approval should be re-published to cloud after a local merge. */
function profilesNeedingApprovalPublish(
  merged: DadProfile[],
  remote: DadProfile[],
): DadProfile[] {
  const remoteById = new Map(remote.map((profile) => [profile.id, profile]));
  return merged.filter((profile) => {
    const rem = remoteById.get(profile.id);
    if (!rem) return profile.approvalStatus === "approved" || profile.approvalStatus === "denied";
    if (profile.approvalStatus === "approved" && rem.approvalStatus !== "approved") return true;
    if (profile.approvalStatus === "denied" && rem.approvalStatus === "pending") return true;
    return false;
  });
}

/** Never let a stale pending local row overwrite approved/denied in cloud. */
function guardAgainstApprovalDowngrade(
  local: DadProfile,
  remote: DadProfile | undefined,
): DadProfile {
  if (!remote) return local;
  if (
    local.approvalStatus === "pending" &&
    (remote.approvalStatus === "approved" || remote.approvalStatus === "denied")
  ) {
    return {
      ...local,
      approvalStatus: remote.approvalStatus,
      accountStatus:
        remote.approvalStatus === "approved"
          ? local.accountStatus === "suspended"
            ? "suspended"
            : remote.accountStatus ?? local.accountStatus ?? "active"
          : local.accountStatus,
    };
  }
  return local;
}

async function fetchCloudBins(): Promise<CloudBinRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("dad_bins")
    .select("bin_id, document, updated_at")
    .eq("workspace_id", DAD_WORKSPACE_ID);

  if (error) {
    lastSyncError = error.message;
    notifyCloudStatusListeners();
    console.warn("[cloudSync] Failed to fetch bins:", error.message);
    return [];
  }

  return (data ?? []) as CloudBinRow[];
}

async function fetchCloudProfiles(): Promise<DadProfile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("dad_profiles").select("*");
  if (error) {
    lastSyncError = error.message;
    notifyCloudStatusListeners();
    console.warn("[cloudSync] Failed to fetch profiles:", error.message);
    return [];
  }

  return ((data ?? []) as CloudProfileRow[]).map(rowToProfile);
}

async function fetchCloudKv(): Promise<CloudKvRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("dad_kv")
    .select("scope_key, kv_key, value, updated_at")
    .eq("workspace_id", DAD_WORKSPACE_ID);

  if (error) {
    console.warn("[cloudSync] Failed to fetch kv:", error.message);
    return [];
  }

  return (data ?? []) as CloudKvRow[];
}

function applyKvToLocalStorage(rows: CloudKvRow[]): void {
  for (const key of SYNCED_KV_KEYS) {
    const remote = rows.find((row) => row.scope_key === GLOBAL_KV_SCOPE && row.kv_key === key);
    if (!remote) continue;

    try {
      const serialized =
        typeof remote.value === "string" ? remote.value : JSON.stringify(remote.value);

      // Never let an older cloud epoch overwrite a newer local factory-reset marker.
      if (key === WORKSPACE_EPOCH_KEY) {
        const localEpoch = getWorkspaceEpoch();
        const remoteEpoch = serialized.replace(/^"|"$/g, "");
        if (localEpoch && remoteEpoch && localEpoch >= remoteEpoch) continue;
      }

      localStorage.setItem(key, serialized);
    } catch (err) {
      console.warn(`[cloudSync] Could not apply kv ${key}:`, err);
    }
  }
}

async function upsertCloudBin(binId: string, document: DataBinDocument): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("dad_bins").upsert(
    {
      workspace_id: DAD_WORKSPACE_ID,
      bin_id: binId,
      document,
      updated_at: document.updatedAt,
    },
    { onConflict: "workspace_id,bin_id" },
  );

  if (error) console.warn(`[cloudSync] Failed to push bin ${binId}:`, error.message);
}

export function touchCloudKv(storageKey: SyncedKvKey): void {
  scheduleCloudKvPush(storageKey);
}

async function upsertCloudProfiles(profiles: DadProfile[]): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !profiles.length) return true;

  // Re-read cloud so a stale pending row cannot overwrite an approved member.
  let remoteById = new Map<string, DadProfile>();
  try {
    const remote = await fetchCloudProfiles();
    remoteById = new Map(remote.map((profile) => [profile.id, profile]));
  } catch (err) {
    console.warn("[cloudSync] Could not verify remote approvals before push:", err);
  }

  const safeProfiles = profiles.map((profile) =>
    guardAgainstApprovalDowngrade(profile, remoteById.get(profile.id)),
  );

  const rows = safeProfiles.map((profile) => {
    const row = profileToRow(profile);
    // Keep REST payloads small — large data-URL photos can fail upserts silently for the whole batch.
    if (row.profile_photo_url && row.profile_photo_url.length > 8_000) {
      row.profile_photo_url = null;
    }
    return row;
  });

  const { error } = await supabase.from("dad_profiles").upsert(rows, { onConflict: "id" });
  if (error) {
    lastSyncError = `Failed to push profiles: ${error.message}`;
    notifyCloudStatusListeners();
    console.warn("[cloudSync] Failed to push profiles:", error.message);

    // Retry one-by-one so a single bad row cannot block the whole directory.
    let failed = 0;
    for (const row of rows) {
      const { error: rowError } = await supabase
        .from("dad_profiles")
        .upsert(row, { onConflict: "id" });
      if (rowError) {
        failed += 1;
        console.warn(`[cloudSync] Failed to push profile ${row.username}:`, rowError.message);
      }
    }
    return failed === 0;
  }

  if (lastSyncError?.startsWith("Failed to push profiles:")) {
    lastSyncError = null;
    notifyCloudStatusListeners();
  }
  return true;
}

/** Immediately upsert profiles (used on register / critical writes). */
export async function pushCloudProfilesNow(profiles: DadProfile[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  if (pendingProfilePush) {
    clearTimeout(pendingProfilePush);
    pendingProfilePush = null;
  }
  return upsertCloudProfiles(profiles);
}

/**
 * Master reset: delete every cloud profile not in `profiles`, then upsert the keepers.
 * Upsert alone cannot remove members, so a factory reset would otherwise resurrect them.
 */
export async function replaceCloudProfilesDirectory(profiles: DadProfile[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;

  const supabase = getSupabaseClient();
  if (!supabase) return true;

  if (pendingProfilePush) {
    clearTimeout(pendingProfilePush);
    pendingProfilePush = null;
  }

  try {
    const remote = await fetchCloudProfiles();
    const keepIds = new Set(profiles.map((profile) => profile.id));
    const staleIds = remote.map((profile) => profile.id).filter((id) => !keepIds.has(id));

    if (staleIds.length) {
      // Delete in chunks — some PostgREST gateways cap `.in()` lists.
      for (let index = 0; index < staleIds.length; index += 100) {
        const chunk = staleIds.slice(index, index + 100);
        const { error } = await supabase.from("dad_profiles").delete().in("id", chunk);
        if (error) {
          console.warn("[cloudSync] Failed to delete stale profiles during reset:", error.message);
          throw new Error(`Failed to delete cloud members: ${error.message}`);
        }
      }
    }
  } catch (err) {
    console.warn("[cloudSync] Could not prune remote profiles during reset:", err);
    throw err;
  }

  return upsertCloudProfiles(profiles);
}

/**
 * Hard wipe Supabase workspace data (bins + kv + non-admin profiles).
 * Used by master reset so past platform data cannot reload from the cloud.
 */
export async function wipeCloudWorkspaceExceptAdmin(admin: DadProfile): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  for (const timer of pendingBinPushes.values()) clearTimeout(timer);
  pendingBinPushes.clear();
  if (pendingProfilePush) {
    clearTimeout(pendingProfilePush);
    pendingProfilePush = null;
  }
  for (const timer of pendingKvPushes.values()) clearTimeout(timer);
  pendingKvPushes.clear();

  // 1) Profiles: only master admin remains.
  await replaceCloudProfilesDirectory([admin]);

  // 2) Bins: push the post-reset local documents (empty members/txns + seeded $0 pool).
  const wipedAt = new Date().toISOString();
  await Promise.all(
    DATA_BIN_DEFINITIONS.map((definition) => {
      const local = readDataBin(definition.key);
      const document: DataBinDocument = {
        ...local,
        version: local.version ?? 1,
        binKey: definition.key,
        // Ensure cloud timestamp beats any pre-reset remote row.
        updatedAt: local.updatedAt && local.updatedAt > wipedAt ? local.updatedAt : wipedAt,
        records: Array.isArray(local.records) ? local.records : [],
      };
      return upsertCloudBin(definition.binId, document);
    }),
  );

  // 3) Clear synced kv noise (notifications, etc.), then publish reset epoch.
  for (const key of SYNCED_KV_KEYS) {
    if (key === WORKSPACE_EPOCH_KEY) continue;
    const { error } = await supabase
      .from("dad_kv")
      .delete()
      .eq("workspace_id", DAD_WORKSPACE_ID)
      .eq("scope_key", GLOBAL_KV_SCOPE)
      .eq("kv_key", key);
    if (error) {
      console.warn(`[cloudSync] Failed to clear kv ${key} during reset:`, error.message);
    }
  }

  const epoch = getWorkspaceEpoch() ?? bumpWorkspaceEpoch();
  await upsertCloudKv(GLOBAL_KV_SCOPE, WORKSPACE_EPOCH_KEY, JSON.stringify(epoch));
}

/**
 * Pull profiles before login/register so approval status and credentials
 * from other devices are visible on the auth screen (which has no cloud sync).
 */
export async function pullCloudProfilesNow(
  getLocalProfiles: () => DadProfile[],
  replaceLocalProfiles: (profiles: DadProfile[]) => void,
): Promise<DadProfile[]> {
  if (!isSupabaseConfigured()) return getLocalProfiles();

  try {
    const localProfiles = getLocalProfiles();

    // After master reset, keep admin-only local directory and re-prune cloud members.
    if (shouldHonorFactoryResetDirectory(localProfiles)) {
      replaceLocalProfiles(localProfiles);
      void replaceCloudProfilesDirectory(localProfiles).catch((err) =>
        console.warn("[cloudSync] Post-reset profile prune failed:", err),
      );
      return localProfiles;
    }

    const remote = await fetchCloudProfiles();
    const merged = mergeProfiles(localProfiles, remote);
    replaceLocalProfiles(merged);

    const needsPublish = profilesNeedingApprovalPublish(merged, remote);
    if (needsPublish.length > 0) {
      void upsertCloudProfiles(needsPublish).catch((err) =>
        console.warn("[cloudSync] Approval re-publish after pull failed:", err),
      );
    }

    return merged;
  } catch (err) {
    console.warn("[cloudSync] Auth profile pull failed:", err);
    return getLocalProfiles();
  }
}

async function upsertCloudKv(scopeKey: string, kvKey: string, rawValue: string | null): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || rawValue == null) return;

  let parsed: unknown = rawValue;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    parsed = rawValue;
  }

  const { error } = await supabase.from("dad_kv").upsert(
    {
      workspace_id: DAD_WORKSPACE_ID,
      scope_key: scopeKey,
      kv_key: kvKey,
      value: parsed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,scope_key,kv_key" },
  );

  if (error) console.warn(`[cloudSync] Failed to push kv ${kvKey}:`, error.message);
}

export function scheduleCloudBinPush(binId: string, document: DataBinDocument): void {
  if (!isSupabaseConfigured() || !cloudPushesAllowed()) return;
  // Delivery lock / post-wipe: do not let a fat local browser resurrect cloud balances.
  if (isFactoryZeroLockedLocally()) return;

  const existing = pendingBinPushes.get(binId);
  if (existing) clearTimeout(existing);

  pendingBinPushes.set(
    binId,
    setTimeout(() => {
      pendingBinPushes.delete(binId);
      if (!cloudPushesAllowed()) return;
      if (isFactoryZeroLockedLocally()) return;
      void upsertCloudBin(binId, document);
    }, CLOUD_PUSH_DEBOUNCE_MS),
  );
}

/** Immediately upsert one or more bins (used after contributions). */
export async function pushCloudBinsNow(
  bins: Array<{ binId: string; document: DataBinDocument }>,
): Promise<void> {
  if (!isSupabaseConfigured() || !bins.length) return;

  for (const { binId } of bins) {
    const existing = pendingBinPushes.get(binId);
    if (existing) {
      clearTimeout(existing);
      pendingBinPushes.delete(binId);
    }
  }

  await Promise.all(bins.map(({ binId, document }) => upsertCloudBin(binId, document)));
}

let profilePushQueuedWhilePaused = false;
let pauseFlushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePausedProfileFlush(): void {
  if (pauseFlushTimer) return;
  const wait = Math.max(0, cloudPushPausedUntil - Date.now()) + 50;
  pauseFlushTimer = setTimeout(() => {
    pauseFlushTimer = null;
    if (!cloudPushesAllowed()) {
      schedulePausedProfileFlush();
      return;
    }
    if (!profilePushQueuedWhilePaused) return;
    profilePushQueuedWhilePaused = false;
    void import("../dadProfileStorage")
      .then(({ getDadProfiles }) => upsertCloudProfiles(getDadProfiles()))
      .catch((err) => console.warn("[cloudSync] Paused profile flush failed:", err));
  }, wait);
}

export function scheduleCloudProfilesPush(_profiles?: DadProfile[]): void {
  if (!isSupabaseConfigured()) return;

  if (!cloudPushesAllowed()) {
    profilePushQueuedWhilePaused = true;
    schedulePausedProfileFlush();
    return;
  }

  if (pendingProfilePush) clearTimeout(pendingProfilePush);
  pendingProfilePush = setTimeout(() => {
    pendingProfilePush = null;
    if (!cloudPushesAllowed()) {
      profilePushQueuedWhilePaused = true;
      schedulePausedProfileFlush();
      return;
    }
    // Always read fresh profiles — never push a stale closed-over snapshot.
    void import("../dadProfileStorage")
      .then(({ getDadProfiles }) => upsertCloudProfiles(getDadProfiles()))
      .catch((err) => console.warn("[cloudSync] Scheduled profile push failed:", err));
  }, CLOUD_PUSH_DEBOUNCE_MS);
}

export function scheduleCloudKvPush(kvKey: SyncedKvKey): void {
  if (!isSupabaseConfigured() || !cloudPushesAllowed()) return;

  const existing = pendingKvPushes.get(kvKey);
  if (existing) clearTimeout(existing);

  pendingKvPushes.set(
    kvKey,
    setTimeout(() => {
      pendingKvPushes.delete(kvKey);
      if (!cloudPushesAllowed()) return;
      void upsertCloudKv(GLOBAL_KV_SCOPE, kvKey, localStorage.getItem(kvKey));
    }, CLOUD_PUSH_DEBOUNCE_MS),
  );
}

export function isCloudSyncReady(): boolean {
  return cloudInitialized && isSupabaseConfigured();
}

export async function syncCloudWorkspace(options: {
  getLocalProfiles: () => DadProfile[];
  replaceLocalProfiles: (profiles: DadProfile[]) => void;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const [remoteBins, remoteProfiles, remoteKv] = await Promise.all([
      fetchCloudBins(),
      fetchCloudProfiles(),
      fetchCloudKv(),
    ]);

    const cloudEmpty = remoteBins.length === 0 && remoteProfiles.length === 0;
    const remoteEpoch = getRemoteWorkspaceEpoch(remoteKv);
    const localEpoch = getWorkspaceEpoch();
    const adoptCloudWipe = Boolean(remoteEpoch && (!localEpoch || remoteEpoch > localEpoch));
    const honorLocalReset =
      Boolean(localEpoch) && (!remoteEpoch || localEpoch! >= remoteEpoch) && !adoptCloudWipe;

    const binUpserts: Promise<unknown>[] = [];

    // Newer cloud factory wipe wins — stop fat localStorage/devices from re-seeding production.
    if (adoptCloudWipe) {
      applyKvToLocalStorage(remoteKv);
      try {
        localStorage.setItem("dollar-a-day-factory-zero", "1");
      } catch {
        /* ignore */
      }
      pauseCloudPushes(24 * 60 * 60_000);

      for (const binId of DAD_BIN_IDS) {
        const binKey = binKeyForBinId(binId);
        if (!binKey) continue;
        const remoteRow = remoteBins.find((row) => row.bin_id === binId);
        if (remoteRow?.document) {
          applyExternalBinDocument(binId, binKey, remoteRow.document);
        }
      }

      const remoteAdminOnly = isAdminOnlyDirectory(remoteProfiles);
      if (remoteAdminOnly || remoteProfiles.some((profile) => isAdminProfile(profile))) {
        const nextProfiles = remoteAdminOnly
          ? remoteProfiles
          : remoteProfiles.filter((profile) => isAdminProfile(profile)).slice(0, 1);
        options.replaceLocalProfiles(nextProfiles);
        if (remoteAdminOnly) {
          await replaceCloudProfilesDirectory(nextProfiles);
        }
      }

      lastSyncAt = new Date().toISOString();
      lastSyncError = null;
      notifyCloudStatusListeners();
      return;
    }

    for (const binId of DAD_BIN_IDS) {
      const binKey = binKeyForBinId(binId);
      if (!binKey) continue;

      const remoteRow = remoteBins.find((row) => row.bin_id === binId);
      const localDoc = readDataBin(binKey);

      if (honorLocalReset) {
        // This device performed the wipe — push $0 bins; never merge pre-reset cloud rows.
        applyExternalBinDocument(binId, binKey, localDoc);
        binUpserts.push(upsertCloudBin(binId, localDoc));
        continue;
      }

      const { merged, source } = mergeBinDocuments(localDoc, remoteRow?.document ?? null);

      applyExternalBinDocument(binId, binKey, merged);

      // Seed empty cloud, push local wins, or publish record-level merges so every
      // member contribution reaches the shared liquidity workspace.
      if (cloudEmpty || source === "local" || source === "merged") {
        binUpserts.push(upsertCloudBin(binId, merged));
      }
    }

    await Promise.all(binUpserts);

    const localProfiles = options.getLocalProfiles();
    let mergedProfiles: DadProfile[];

    if (shouldHonorFactoryResetDirectory(localProfiles)) {
      // Factory reset is authoritative — do not resurrect deleted members from cloud.
      mergedProfiles = localProfiles;
      options.replaceLocalProfiles(mergedProfiles);
      await replaceCloudProfilesDirectory(mergedProfiles);
    } else {
      mergedProfiles = mergeProfiles(localProfiles, remoteProfiles);
      options.replaceLocalProfiles(mergedProfiles);

      // Always publish the merged profile directory so master admin sees every member worldwide.
      if (mergedProfiles.length > 0) {
        await upsertCloudProfiles(mergedProfiles);
      }
    }

    applyKvToLocalStorage(remoteKv);

    const kvUpserts: Promise<unknown>[] = [];
    for (const key of SYNCED_KV_KEYS) {
      const localRaw = localStorage.getItem(key);
      const remote = remoteKv.find((row) => row.scope_key === GLOBAL_KV_SCOPE && row.kv_key === key);
      if (localRaw && (!remote || cloudEmpty)) {
        kvUpserts.push(upsertCloudKv(GLOBAL_KV_SCOPE, key, localRaw));
      }
    }
    await Promise.all(kvUpserts);

    lastSyncAt = new Date().toISOString();
    lastSyncError = null;
    notifyCloudStatusListeners();
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    notifyCloudStatusListeners();
    console.warn("[cloudSync] Workspace sync failed:", lastSyncError);
  }
}

function handleRemoteBinChange(binId: string, document: DataBinDocument): void {
  // Client-delivery lock: ignore realtime cloud pushes that would resurrect balances.
  try {
    if (localStorage.getItem("dollar-a-day-factory-zero") === "1") return;
  } catch {
    /* ignore */
  }
  const binKey = binKeyForBinId(binId);
  if (!binKey) return;
  const localDoc = readDataBin(binKey);
  const { merged } = mergeBinDocuments(localDoc, document);
  applyExternalBinDocument(binId, binKey, merged);
}

export function startCloudRealtime(options: {
  getLocalProfiles: () => DadProfile[];
  onProfilesChanged: (profiles: DadProfile[]) => void;
}): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  if (realtimeChannel) {
    void supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel(`dad-workspace-${DAD_STORAGE_PROFILE_ID}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dad_bins", filter: `workspace_id=eq.${DAD_WORKSPACE_ID}` },
      (payload) => {
        const row = payload.new as CloudBinRow | null;
        if (row?.bin_id && row.document) {
          handleRemoteBinChange(row.bin_id, row.document as DataBinDocument);
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dad_profiles" },
      async () => {
        const localProfiles = options.getLocalProfiles();
        if (shouldHonorFactoryResetDirectory(localProfiles)) {
          options.onProfilesChanged(localProfiles);
          void replaceCloudProfilesDirectory(localProfiles).catch((err) =>
            console.warn("[cloudSync] Realtime post-reset prune failed:", err),
          );
          return;
        }

        const remote = await fetchCloudProfiles();
        const merged = mergeProfiles(localProfiles, remote);
        options.onProfilesChanged(merged);

        const needsPublish = profilesNeedingApprovalPublish(merged, remote);
        if (needsPublish.length > 0) {
          void upsertCloudProfiles(needsPublish).catch((err) =>
            console.warn("[cloudSync] Approval re-publish after realtime merge failed:", err),
          );
        }
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dad_kv", filter: `workspace_id=eq.${DAD_WORKSPACE_ID}` },
      (payload) => {
        const row = payload.new as CloudKvRow | null;
        if (!row?.kv_key || row.scope_key !== GLOBAL_KV_SCOPE) return;
        if (!(SYNCED_KV_KEYS as readonly string[]).includes(row.kv_key)) return;
        try {
          localStorage.setItem(
            row.kv_key,
            typeof row.value === "string" ? row.value : JSON.stringify(row.value),
          );
        } catch (err) {
          console.warn("[cloudSync] Remote kv apply failed:", err);
        }
      },
    )
    .subscribe();

  return () => {
    if (realtimeChannel) {
      void supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

/** Backup poll if realtime drops; realtime is the primary sync path. */
let syncInFlight: Promise<void> | null = null;

export async function initCloudSync(options: {
  getLocalProfiles: () => DadProfile[];
  replaceLocalProfiles: (profiles: DadProfile[]) => void;
  onProfilesChanged: (profiles: DadProfile[]) => void;
}): Promise<() => void> {
  if (!isSupabaseConfigured()) {
    cloudInitialized = false;
    lastSyncError = "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY";
    notifyCloudStatusListeners();
    return () => {};
  }

  pauseCloudPushes(12_000);

  const runSync = () => {
    if (syncInFlight) return syncInFlight;
    syncInFlight = syncCloudWorkspace(options)
      .then(() => {
        lastFullSyncAt = Date.now();
      })
      .finally(() => {
        syncInFlight = null;
      });
    return syncInFlight;
  };

  await runSync();
  cloudInitialized = true;
  notifyCloudStatusListeners();

  // Rare backup pull only — realtime handles live updates.
  const pollId = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    void runSync();
  }, CLOUD_POLL_MS);

  // Do NOT full-resync on every tab focus — that was a major freeze.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastFullSyncAt < CLOUD_VISIBLE_RESYNC_MIN_MS) return;
    void runSync();
  };
  document.addEventListener("visibilitychange", onVisible);

  const stopRealtime = startCloudRealtime({
    getLocalProfiles: options.getLocalProfiles,
    onProfilesChanged: options.onProfilesChanged,
  });

  return () => {
    window.clearInterval(pollId);
    document.removeEventListener("visibilitychange", onVisible);
    stopRealtime();
  };
}
