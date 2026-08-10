import type { RealtimeChannel } from "@supabase/supabase-js";
import { isAdminProfile } from "../../../config/admin";
import { DAD_BIN_IDS, DAD_STORAGE_PROFILE_ID, DATA_BIN_DEFINITIONS, type DataBinKey } from "../dataBins";
import type { DadProfile } from "../dadProfileStorage";
import {
  applyExternalBinDocument,
  beginBulkWrite,
  endBulkWrite,
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

/** Profile IDs admin permanently deleted — block cloud merge from resurrecting them. */
const DELETED_PROFILES_KEY = "dollar-a-day-deleted-profiles";

let lastFullSyncAt = 0;
let cloudPushPausedUntil = 0;

function readDeletedProfileIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_PROFILES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeDeletedProfileIds(ids: Set<string>): void {
  try {
    localStorage.setItem(DELETED_PROFILES_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

export function rememberDeletedProfileId(profileId: string): void {
  if (!profileId) return;
  const ids = readDeletedProfileIds();
  ids.add(profileId);
  writeDeletedProfileIds(ids);
}

export function forgetDeletedProfileId(profileId: string): void {
  if (!profileId) return;
  const ids = readDeletedProfileIds();
  if (!ids.delete(profileId)) return;
  writeDeletedProfileIds(ids);
}

export function isDeletedProfileId(profileId: string): boolean {
  return Boolean(profileId) && readDeletedProfileIds().has(profileId);
}

function excludeDeletedProfiles(profiles: DadProfile[]): DadProfile[] {
  const deleted = readDeletedProfileIds();
  if (!deleted.size) return profiles;
  return profiles.filter((profile) => !deleted.has(profile.id));
}

/**
 * Permanently remove one member from Supabase `dad_profiles` and push cleaned bins.
 */
export async function deleteCloudMemberProfile(profileId: string): Promise<boolean> {
  if (!profileId) return false;
  if (!isSupabaseConfigured()) return true;

  const supabase = getSupabaseClient();
  if (!supabase) return true;

  rememberDeletedProfileId(profileId);
  pauseCloudPushes(0);

  const { error } = await supabase.from("dad_profiles").delete().eq("id", profileId);
  if (error) {
    console.warn("[cloudSync] Failed to delete cloud member profile:", error.message);
    return false;
  }

  // Verify the row is gone — retry once if it still appears.
  try {
    const stillThere = (await fetchCloudProfiles()).some((profile) => profile.id === profileId);
    if (stillThere) {
      const { error: retryError } = await supabase.from("dad_profiles").delete().eq("id", profileId);
      if (retryError) {
        console.warn("[cloudSync] Retry delete cloud member failed:", retryError.message);
        return false;
      }
    }
  } catch (err) {
    console.warn("[cloudSync] Could not verify member cloud delete:", err);
  }

  // Push members + settings bins so remote ledger/member rows do not linger.
  try {
    await pushCloudBinsNow(
      [
        { binId: "dollar-a-day-members", document: readDataBin("members") },
        { binId: "dollar-a-day-settings", document: readDataBin("settings") },
        { binId: "dollar-a-day-contributions", document: readDataBin("contributions") },
        { binId: "dollar-a-day-community-posts", document: readDataBin("communityPosts") },
        { binId: "dollar-a-day-admin-captures", document: readDataBin("adminCaptures") },
        { binId: "dollar-a-day-allocations", document: readDataBin("allocations") },
      ],
      { force: true },
    );
  } catch (err) {
    console.warn("[cloudSync] Bin push after member delete failed:", err);
  }

  return true;
}

/** Pause outbound cloud pushes during the interactive window after login. */
export function pauseCloudPushes(ms = 15_000): void {
  cloudPushPausedUntil = Date.now() + Math.max(0, ms);
}

function cloudPushesAllowed(): boolean {
  return Date.now() >= cloudPushPausedUntil;
}

/** Opportunistic sync while hard-reset lock is active would resurrect wiped members. */
function opportunisticCloudPushBlocked(): boolean {
  return isFactoryZeroLocked() || !cloudPushesAllowed();
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

function isAdminOnlyDirectory(profiles: DadProfile[]): boolean {
  return !profiles.some((profile) => !isAdminProfile(profile));
}

function profileSurvivesFactoryEpoch(profile: DadProfile): boolean {
  if (isAdminProfile(profile)) return true;
  const epoch = getWorkspaceEpoch();
  if (!epoch) return true;
  return profileTimestamp(profile) >= epoch;
}

/**
 * Blank / factory-zero cloud wins whenever remote is admin-only.
 * Epoch comparison used to skip adopt when local epoch was newer — that left
 * stale browser caches showing old members/liquidity on an empty cloud.
 */
function shouldAdoptRemoteAdminOnlyWipe(remoteProfiles: DadProfile[]): boolean {
  return isAdminOnlyDirectory(remoteProfiles);
}

function lockLocalToRemoteWipe(remoteEpoch: string | null): void {
  try {
    localStorage.setItem("dollar-a-day-factory-zero", "1");
    if (remoteEpoch) {
      localStorage.setItem(WORKSPACE_EPOCH_KEY, remoteEpoch);
    } else {
      bumpWorkspaceEpoch();
    }
  } catch {
    /* ignore */
  }
  pauseCloudPushes(24 * 60 * 60_000);
}

function emptyWipeBinDocument(binKey: DataBinKey, stamp: string): DataBinDocument {
  return { version: 1, binKey, updatedAt: stamp, records: [] };
}

/** Replace local bins with blank-cloud documents (or empty if a bin row is missing). */
function applyAdminOnlyRemoteBins(remoteBins: CloudBinRow[]): void {
  const stamp = new Date().toISOString();
  beginBulkWrite();
  try {
    for (const binId of DAD_BIN_IDS) {
      const binKey = binKeyForBinId(binId);
      if (!binKey) continue;
      const remoteRow = remoteBins.find((row) => row.bin_id === binId);
      const document = remoteRow?.document ?? emptyWipeBinDocument(binKey, stamp);
      applyExternalBinDocument(binId, binKey, document);
    }
  } finally {
    endBulkWrite();
  }
}

function refreshUiAfterLocalWipe(): void {
  queueMicrotask(() => {
    void Promise.all([import("../memberAccounts"), import("../poolState")])
      .then(([{ invalidateMemberAccountsCache }, { hydratePoolStateFromStorage }]) => {
        invalidateMemberAccountsCache();
        hydratePoolStateFromStorage();
      })
      .catch(() => {});
  });
}

/** Merge local/remote profiles while dropping pre-wipe members; reopen delivery lock when new members appear. */
function mergeProfilesForWorkspace(local: DadProfile[], remote: DadProfile[]): DadProfile[] {
  // Admin-only cloud = blank platform. Never keep local-only members.
  if (isAdminOnlyDirectory(remote)) {
    const adminRemote = remote.filter((profile) => isAdminProfile(profile)).slice(0, 1);
    return adminRemote.length
      ? adminRemote
      : local.filter((profile) => isAdminProfile(profile)).slice(0, 1);
  }

  const merged = excludeDeletedProfiles(mergeProfiles(local, remote)).filter(
    (profile) => isAdminProfile(profile) || profileSurvivesFactoryEpoch(profile),
  );
  if (merged.some((profile) => !isAdminProfile(profile) && profileSurvivesFactoryEpoch(profile))) {
    clearFactoryZeroDeliveryLock();
  }
  return merged;
}

/** End client-delivery zero lock so members can sync and appear in the directory again. */
export function clearFactoryZeroDeliveryLock(): void {
  try {
    localStorage.removeItem("dollar-a-day-factory-zero");
    // Epoch was used to hide pre-wipe cloud rows; leaving it set keeps Members empty.
    localStorage.removeItem(WORKSPACE_EPOCH_KEY);
  } catch {
    /* ignore */
  }
  cloudPushPausedUntil = 0;
  // Also clear the on-disk FACTORY_ZERO.lock (dev) — it was wiping members on every boot.
  void import("../internalDatabase")
    .then(({ clearFactoryZeroDisk }) => clearFactoryZeroDisk())
    .catch(() => {});
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
  account_number: string | null;
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

/**
 * Schema may lag behind the app — omit account_number when the column is absent.
 * Default false: production dad_profiles has no account_number column; starting true
 * made every signup/approve upsert fail once with 400 before retry.
 */
let cloudSupportsAccountNumber = false;

function profileToRow(profile: DadProfile, options: { includeAccountNumber?: boolean } = {}) {
  const includeAccountNumber = options.includeAccountNumber ?? cloudSupportsAccountNumber;
  const row: Record<string, unknown> = {
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
  if (includeAccountNumber) {
    row.account_number = profile.accountNumber ?? null;
  }
  return row;
}

function isMissingAccountNumberColumnError(message: string | undefined): boolean {
  const text = String(message ?? "").toLowerCase();
  return text.includes("account_number") && (text.includes("schema cache") || text.includes("column"));
}

function rowToProfile(row: CloudProfileRow): DadProfile {
  const username = row.username;
  const rawApproval = row.approval_status as DadProfile["approvalStatus"] | null | undefined;
  const approvalStatus: DadProfile["approvalStatus"] = isAdminProfile({ username })
    ? "approved"
    : rawApproval === "approved" || rawApproval === "denied" || rawApproval === "pending"
      ? rawApproval
      : "pending";

  return {
    id: row.id,
    username,
    password: row.password,
    displayName: row.display_name,
    fullName: row.full_name ?? undefined,
    role: row.role ?? undefined,
    proId: row.pro_id ?? undefined,
    accountNumber: row.account_number ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    referredByProId: row.referred_by_pro_id ?? undefined,
    accountStatus: (row.account_status as DadProfile["accountStatus"]) ?? undefined,
    approvalStatus,
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

  // Master admin is always approved.
  if (isAdminProfile(winner) || isAdminProfile(local) || isAdminProfile(remote)) {
    return { ...winner, approvalStatus: "approved" };
  }

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

  // New signups must stay pending until master admin approves — never drop status.
  if (
    localStatus === "pending" ||
    remoteStatus === "pending" ||
    winnerStatus === "pending" ||
    localStatus == null ||
    remoteStatus == null ||
    winnerStatus == null
  ) {
    return { ...winner, approvalStatus: "pending" };
  }

  return winner;
}

function mergeProfiles(local: DadProfile[], remote: DadProfile[]): DadProfile[] {
  // Always accept remote profiles. The factory-wipe epoch previously dropped the
  // entire member directory after client handoff and broke create→approve→login.
  const map = new Map<string, DadProfile>();
  for (const profile of remote) map.set(profile.id, profile);
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
    const withApproval = preferApprovalStatus(winner, profile, existing);
    map.set(profile.id, preferAccountNumber(withApproval, profile, existing));
  }
  return Array.from(map.values());
}

function preferAccountNumber(
  winner: DadProfile,
  local: DadProfile,
  remote: DadProfile,
): DadProfile {
  if (/^\d{16}$/.test(winner.accountNumber ?? "")) return winner;
  const fallback = /^\d{16}$/.test(local.accountNumber ?? "")
    ? local.accountNumber
    : /^\d{16}$/.test(remote.accountNumber ?? "")
      ? remote.accountNumber
      : undefined;
  if (!fallback) return winner;
  return { ...winner, accountNumber: fallback };
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
    // Never return [] on error — callers would treat cloud as empty and keep local pending.
    throw new Error(error.message || "Failed to fetch profiles");
  }

  return ((data ?? []) as CloudProfileRow[]).map(rowToProfile);
}

/** Fast auth lookup — one username row instead of the full directory. */
async function fetchCloudProfileByUsername(username: string): Promise<DadProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const normalized = username.trim();
  if (!normalized) return null;

  // Escape ILIKE wildcards so usernames with _ or % match literally.
  const pattern = normalized.replace(/([\\%_])/g, "\\$1");
  const { data, error } = await supabase
    .from("dad_profiles")
    .select("*")
    .ilike("username", pattern)
    .limit(1)
    .maybeSingle();

  if (error) {
    lastSyncError = error.message;
    notifyCloudStatusListeners();
    console.warn("[cloudSync] Failed to fetch profile by username:", error.message);
    throw new Error(error.message || "Failed to fetch profile");
  }

  return data ? rowToProfile(data as CloudProfileRow) : null;
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
        // Do not re-apply a wipe epoch while members are being restored.
        if (localStorage.getItem("dollar-a-day-factory-zero") !== "1") {
          continue;
        }
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

  const row = {
    workspace_id: DAD_WORKSPACE_ID,
    bin_id: binId,
    document,
    updated_at: document.updatedAt,
  };

  // Prefer PATCH so JSON `document` is fully replaced (upsert merge can leave stale pool/members).
  const { data: existing, error: readError } = await supabase
    .from("dad_bins")
    .select("bin_id")
    .eq("workspace_id", DAD_WORKSPACE_ID)
    .eq("bin_id", binId)
    .maybeSingle();

  if (readError) {
    console.warn(`[cloudSync] Failed to read bin ${binId}:`, readError.message);
  }

  if (existing?.bin_id) {
    const { error } = await supabase
      .from("dad_bins")
      .update({ document: row.document, updated_at: row.updated_at })
      .eq("workspace_id", DAD_WORKSPACE_ID)
      .eq("bin_id", binId);
    if (error) console.warn(`[cloudSync] Failed to update bin ${binId}:`, error.message);
    return;
  }

  const { error } = await supabase.from("dad_bins").insert(row);
  if (error) console.warn(`[cloudSync] Failed to insert bin ${binId}:`, error.message);
}

export function touchCloudKv(storageKey: SyncedKvKey): void {
  scheduleCloudKvPush(storageKey);
}

async function upsertCloudProfiles(
  profiles: DadProfile[],
  options: { force?: boolean } = {},
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !profiles.length) return true;

  // Master reset lock blocks opportunistic republish of wiped members.
  // Critical paths (signup / approve / deny) pass force=true after clearing the lock.
  let publishProfiles = profiles;
  if (isFactoryZeroLocked() && !options.force) {
    const members = profiles.filter((profile) => !isAdminProfile(profile));
    publishProfiles = profiles.filter((profile) => isAdminProfile(profile));
    if (members.length && !publishProfiles.length) {
      console.warn(
        "[cloudSync] Refusing to drop member profile push while factory-zero is locked.",
      );
      return false;
    }
    if (members.length) {
      console.warn(
        `[cloudSync] Skipped ${members.length} member profile(s) while factory-zero is locked.`,
      );
    }
  }
  if (!publishProfiles.length) return true;

  // Re-read cloud so a stale pending row cannot overwrite an approved member.
  // If we cannot verify, abort — pushing blind pending would undo admin approval.
  let remoteById = new Map<string, DadProfile>();
  let remoteProfiles: DadProfile[] = [];
  try {
    remoteProfiles = await fetchCloudProfiles();
    remoteById = new Map(remoteProfiles.map((profile) => [profile.id, profile]));
  } catch (err) {
    console.warn("[cloudSync] Could not verify remote approvals before push — aborting:", err);
    return false;
  }

  // Stale browsers must not re-upload wiped members onto an admin-only cloud wipe.
  if (isAdminOnlyDirectory(remoteProfiles) && !options.force) {
    const skipped = publishProfiles.filter((profile) => !isAdminProfile(profile));
    publishProfiles = publishProfiles.filter((profile) => isAdminProfile(profile));
    if (skipped.length) {
      console.warn(
        `[cloudSync] Blocked ${skipped.length} stale member push(es) onto admin-only cloud wipe.`,
      );
    }
    if (!publishProfiles.length) return true;
  }

  const safeProfiles = publishProfiles.map((profile) =>
    guardAgainstApprovalDowngrade(profile, remoteById.get(profile.id)),
  );

  const buildRows = (includeAccountNumber: boolean) =>
    safeProfiles.map((profile) => {
      const row = profileToRow(profile, { includeAccountNumber });
      // Keep REST payloads small — large data-URL photos can fail upserts silently for the whole batch.
      if (
        typeof row.profile_photo_url === "string" &&
        row.profile_photo_url.length > 8_000
      ) {
        row.profile_photo_url = null;
      }
      return row;
    });

  let rows = buildRows(cloudSupportsAccountNumber);
  let { error } = await supabase.from("dad_profiles").upsert(rows, { onConflict: "id" });

  if (error && cloudSupportsAccountNumber && isMissingAccountNumberColumnError(error.message)) {
    cloudSupportsAccountNumber = false;
    console.warn(
      "[cloudSync] dad_profiles.account_number missing — retrying profile push without that column.",
    );
    rows = buildRows(false);
    ({ error } = await supabase.from("dad_profiles").upsert(rows, { onConflict: "id" }));
  }

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
      if (
        rowError &&
        cloudSupportsAccountNumber &&
        isMissingAccountNumberColumnError(rowError.message)
      ) {
        cloudSupportsAccountNumber = false;
        const slim = { ...row };
        delete slim.account_number;
        const { error: retryError } = await supabase
          .from("dad_profiles")
          .upsert(slim, { onConflict: "id" });
        if (!retryError) continue;
        failed += 1;
        console.warn(`[cloudSync] Failed to push profile ${String(row.username)}:`, retryError.message);
        continue;
      }
      if (rowError) {
        failed += 1;
        console.warn(`[cloudSync] Failed to push profile ${String(row.username)}:`, rowError.message);
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

/** Immediately upsert profiles (used on register / approve / critical writes). */
export async function pushCloudProfilesNow(
  profiles: DadProfile[],
  options: { force?: boolean } = {},
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  if (pendingProfilePush) {
    clearTimeout(pendingProfilePush);
    pendingProfilePush = null;
  }
  return upsertCloudProfiles(profiles, options);
}

/**
 * Persist member profiles + members bin after signup/approval so they stay in Supabase.
 * Clears the factory-zero lock first — otherwise member rows are dropped on purpose.
 */
export async function persistMembersToCloud(profiles: DadProfile[]): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  if (!profiles.length) return true;

  clearFactoryZeroDeliveryLock();
  pauseCloudPushes(0);

  const pushed = await pushCloudProfilesNow(profiles, { force: true });
  if (!pushed) return false;

  // Verify rows actually landed — upsert can report success while RLS/filters drop them.
  try {
    const remote = await fetchCloudProfiles();
    const remoteIds = new Set(remote.map((profile) => profile.id));
    const missing = profiles.filter((profile) => !remoteIds.has(profile.id));
    if (missing.length) {
      console.warn(
        `[cloudSync] ${missing.length} member(s) missing after upsert — retrying:`,
        missing.map((profile) => profile.username),
      );
      const retried = await pushCloudProfilesNow(missing, { force: true });
      if (!retried) return false;
      const again = await fetchCloudProfiles();
      const againIds = new Set(again.map((profile) => profile.id));
      if (profiles.some((profile) => !againIds.has(profile.id))) {
        console.error("[cloudSync] Members still missing in Supabase after retry.");
        return false;
      }
    }
  } catch (err) {
    console.warn("[cloudSync] Could not verify member persist:", err);
    return false;
  }

  try {
    const membersDoc = readDataBin("members");
    await pushCloudBinsNow(
      [{ binId: "dollar-a-day-members", document: membersDoc }],
      { force: true },
    );
  } catch (err) {
    console.warn("[cloudSync] Members bin persist failed:", err);
  }
  return true;
}

/**
 * Master reset: delete every cloud profile not in `profiles`, then upsert the keepers.
 * Upsert alone cannot remove members, so a factory reset would otherwise resurrect them.
 */
export async function replaceCloudProfilesDirectory(
  profiles: DadProfile[],
  options: { force?: boolean } = {},
): Promise<boolean> {
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
    const epoch = getWorkspaceEpoch();
    // force=true (master reset): delete every non-keeper regardless of epoch.
    // Otherwise never delete members that registered/updated after the wipe epoch.
    const staleIds = remote
      .filter((profile) => {
        if (keepIds.has(profile.id)) return false;
        if (options.force || !epoch) return true;
        const created = profile.createdAt ?? "";
        const updated = profile.updatedAt ?? "";
        return created < epoch && updated < epoch;
      })
      .map((profile) => profile.id);

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

export function isFactoryZeroLocked(): boolean {
  try {
    return localStorage.getItem("dollar-a-day-factory-zero") === "1";
  } catch {
    return false;
  }
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

  // 1) Profiles: force-delete every non-admin row, retry until cloud is admin-only.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await replaceCloudProfilesDirectory([admin], { force: true });
    const remaining = (await fetchCloudProfiles()).filter((profile) => !isAdminProfile(profile));
    if (!remaining.length) break;
    for (let index = 0; index < remaining.length; index += 100) {
      const chunk = remaining.slice(index, index + 100).map((profile) => profile.id);
      const { error } = await supabase.from("dad_profiles").delete().in("id", chunk);
      if (error) {
        console.warn("[cloudSync] Forced member delete failed:", error.message);
        throw new Error(`Failed to delete cloud members: ${error.message}`);
      }
    }
  }

  const leftoverMembers = (await fetchCloudProfiles()).filter((profile) => !isAdminProfile(profile));
  if (leftoverMembers.length) {
    throw new Error(
      `Master reset could not delete ${leftoverMembers.length} cloud member(s). Try again.`,
    );
  }

  // 2) Hard-empty every bin. Settings keeps only the $0 pool seed record.
  const wipedAt = new Date().toISOString();
  await Promise.all(
    DATA_BIN_DEFINITIONS.map((definition) => {
      const local = readDataBin(definition.key);
      const localRecords = Array.isArray(local.records) ? local.records : [];
      const document: DataBinDocument = {
        version: 1,
        binKey: definition.key,
        updatedAt: wipedAt,
        records:
          definition.key === "settings"
            ? localRecords.filter((record) => record.id === "pool-live-state")
            : [],
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

  // Always pull member profiles — factory-zero must not hide approved members after login.
  const localProfiles = getLocalProfiles();
  const [remote, remoteKv, remoteBins] = await Promise.all([
    fetchCloudProfiles(),
    fetchCloudKv(),
    fetchCloudBins(),
  ]);
  const remoteEpoch = getRemoteWorkspaceEpoch(remoteKv);

  // Blank cloud (admin-only) always formats this browser to $0 — no stale members/bins.
  if (shouldAdoptRemoteAdminOnlyWipe(remote)) {
    applyKvToLocalStorage(remoteKv);
    lockLocalToRemoteWipe(remoteEpoch);
    applyAdminOnlyRemoteBins(remoteBins);
    const adminOnly = remote.filter((profile) => isAdminProfile(profile)).slice(0, 1);
    replaceLocalProfiles(adminOnly);
    refreshUiAfterLocalWipe();
    return adminOnly;
  }

  const merged = mergeProfilesForWorkspace(localProfiles, remote);
  replaceLocalProfiles(merged);

  const needsPublish = profilesNeedingApprovalPublish(merged, remote);
  if (needsPublish.length > 0) {
    void upsertCloudProfiles(needsPublish, { force: true }).catch((err) =>
      console.warn("[cloudSync] Approval re-publish after pull failed:", err),
    );
  }

  return merged;
}

/**
 * Auth-screen fast path: merge a single cloud profile by username.
 * Avoids downloading the whole member directory on every sign-in.
 */
export async function pullCloudProfileForAuth(
  username: string,
  getLocalProfiles: () => DadProfile[],
  replaceLocalProfiles: (profiles: DadProfile[]) => void,
): Promise<DadProfile[]> {
  if (!isSupabaseConfigured()) return getLocalProfiles();

  const localProfiles = getLocalProfiles();
  const remoteProfile = await fetchCloudProfileByUsername(username);
  if (!remoteProfile) return localProfiles;

  // Cloud approval/password wins for this username so members can sign in right after approve.
  const remoteId = remoteProfile.id;
  const withoutStale = localProfiles.filter(
    (profile) =>
      profile.id !== remoteId &&
      profile.username.trim().toLowerCase() !== remoteProfile.username.trim().toLowerCase(),
  );
  const merged = mergeProfilesForWorkspace([...withoutStale, remoteProfile], [remoteProfile]);
  // Ensure the cloud approval status is not lost to a newer stale local pending row.
  const next = merged.map((profile) =>
    profile.id === remoteId ||
    profile.username.trim().toLowerCase() === remoteProfile.username.trim().toLowerCase()
      ? {
          ...profile,
          ...remoteProfile,
          approvalStatus: remoteProfile.approvalStatus ?? profile.approvalStatus,
          accountStatus: remoteProfile.accountStatus ?? profile.accountStatus,
          password: remoteProfile.password || profile.password,
        }
      : profile,
  );
  replaceLocalProfiles(next);
  return next;
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
  if (!isSupabaseConfigured() || opportunisticCloudPushBlocked()) return;

  const existing = pendingBinPushes.get(binId);
  if (existing) clearTimeout(existing);

  pendingBinPushes.set(
    binId,
    setTimeout(() => {
      pendingBinPushes.delete(binId);
      if (opportunisticCloudPushBlocked()) return;
      void upsertCloudBin(binId, document);
    }, CLOUD_PUSH_DEBOUNCE_MS),
  );
}

/** Immediately upsert one or more bins (used after contributions). */
export async function pushCloudBinsNow(
  bins: Array<{ binId: string; document: DataBinDocument }>,
  options: { force?: boolean } = {},
): Promise<void> {
  if (!isSupabaseConfigured() || !bins.length) return;
  // Master reset wipe uses upsertCloudBin directly; block opportunistic restores.
  if (isFactoryZeroLocked() && !options.force) return;

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

  // Hard reset: do not queue member directory republish.
  if (isFactoryZeroLocked()) return;

  if (!cloudPushesAllowed()) {
    profilePushQueuedWhilePaused = true;
    schedulePausedProfileFlush();
    return;
  }

  if (pendingProfilePush) clearTimeout(pendingProfilePush);
  pendingProfilePush = setTimeout(() => {
    pendingProfilePush = null;
    if (isFactoryZeroLocked()) return;
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
  if (!isSupabaseConfigured() || opportunisticCloudPushBlocked()) return;

  const existing = pendingKvPushes.get(kvKey);
  if (existing) clearTimeout(existing);

  pendingKvPushes.set(
    kvKey,
    setTimeout(() => {
      pendingKvPushes.delete(kvKey);
      if (opportunisticCloudPushBlocked()) return;
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
    const remoteHasMembers = remoteProfiles.some((profile) => !isAdminProfile(profile));
    // Never push fat local bins over a blank admin-only cloud.
    const honorLocalReset =
      Boolean(localEpoch) &&
      (!remoteEpoch || localEpoch! >= remoteEpoch) &&
      !adoptCloudWipe &&
      remoteHasMembers;

    const binUpserts: Promise<unknown>[] = [];

    // Blank cloud always formats this device to $0 / admin-only (stale local cache ignored).
    if (shouldAdoptRemoteAdminOnlyWipe(remoteProfiles)) {
      applyKvToLocalStorage(remoteKv);
      lockLocalToRemoteWipe(remoteEpoch);
      applyAdminOnlyRemoteBins(remoteBins);

      const adminOnly = remoteProfiles.filter((profile) => isAdminProfile(profile)).slice(0, 1);
      options.replaceLocalProfiles(adminOnly);
      refreshUiAfterLocalWipe();

      // Ensure cloud stays admin-only (prune any race re-uploads from other tabs).
      if (adminOnly.length) {
        try {
          await replaceCloudProfilesDirectory(adminOnly, { force: true });
        } catch (err) {
          console.warn("[cloudSync] Admin-only wipe reassert failed:", err);
        }
      }

      lastSyncAt = new Date().toISOString();
      lastSyncError = null;
      notifyCloudStatusListeners();
      return;
    }

    if (adoptCloudWipe && remoteHasMembers) {
      // Cloud already has a live member directory — unlock and restore it.
      // Never delete those members; that made approvals disappear after login.
      clearFactoryZeroDeliveryLock();
    }

    beginBulkWrite();
    try {
      for (const binId of DAD_BIN_IDS) {
        const binKey = binKeyForBinId(binId);
        if (!binKey) continue;

        const remoteRow = remoteBins.find((row) => row.bin_id === binId);
        const localDoc = readDataBin(binKey);

        // During an active factory-zero lock, always push local wiped bins — never
        // preserve a populated cloud directory that survived an incomplete reset.
        const factoryZero = isFactoryZeroLocked();
        const skipLocalWipePush =
          !factoryZero &&
          honorLocalReset &&
          remoteHasMembers &&
          binId === "members" &&
          (localDoc.records?.length ?? 0) === 0 &&
          (remoteRow?.document?.records?.length ?? 0) > 0;

        if ((honorLocalReset || factoryZero) && !skipLocalWipePush && (!remoteHasMembers || factoryZero)) {
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
    } finally {
      endBulkWrite();
    }

    await Promise.all(binUpserts);

    const localProfiles = options.getLocalProfiles();
    let mergedProfiles: DadProfile[];

    // Epoch-aware merge keeps wipe integrity but always admits post-wipe registrations.
    mergedProfiles = mergeProfilesForWorkspace(localProfiles, remoteProfiles);
    options.replaceLocalProfiles(mergedProfiles);

    if (mergedProfiles.length > 0) {
      await upsertCloudProfiles(mergedProfiles);
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
        try {
          const localProfiles = options.getLocalProfiles();
          const remote = await fetchCloudProfiles();
          const merged = mergeProfilesForWorkspace(localProfiles, remote);
          options.onProfilesChanged(merged);

          const needsPublish = profilesNeedingApprovalPublish(merged, remote);
          if (needsPublish.length > 0) {
            void upsertCloudProfiles(needsPublish).catch((err) =>
              console.warn("[cloudSync] Approval re-publish after realtime merge failed:", err),
            );
          }
        } catch (err) {
          console.warn("[cloudSync] Realtime profile merge skipped:", err);
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
