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

/**
 * Cloud-wide blank lock. While set, every client must show $0 / admin-only and
 * refuse to upload stale local backtest data — even from other IPs/devices.
 * Cleared only when a real post-wipe member is intentionally persisted.
 */
export const PLATFORM_BLANK_KEY = "dollar-a-day-platform-blank";

/** Profile IDs admin permanently deleted — block cloud merge from resurrecting them. */
const DELETED_PROFILES_KEY = "dollar-a-day-deleted-profiles";

let lastFullSyncAt = 0;
let cloudPushPausedUntil = 0;
let blankPlatformCache: { value: boolean; checkedAt: number } | null = null;
const BLANK_PLATFORM_CACHE_MS = 3_000;

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

  const { error } = await supabase
    .from("dad_profiles")
    .delete()
    .eq("workspace_id", DAD_WORKSPACE_ID)
    .eq("id", profileId);
  if (error) {
    console.warn("[cloudSync] Failed to delete cloud member profile:", error.message);
    return false;
  }

  // Verify the row is gone — retry once if it still appears.
  try {
    const stillThere = (await fetchCloudProfiles()).some((profile) => profile.id === profileId);
    if (stillThere) {
      const { error: retryError } = await supabase
        .from("dad_profiles")
        .delete()
        .eq("workspace_id", DAD_WORKSPACE_ID)
        .eq("id", profileId);
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
  PLATFORM_BLANK_KEY,
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

function isPlatformBlankFlagValue(value: unknown): boolean {
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^"|"$/g, "");
    return trimmed === "1" || trimmed === "true";
  }
  return false;
}

function isPlatformBlankFromKv(remoteKv: CloudKvRow[]): boolean {
  const row = remoteKv.find(
    (item) => item.scope_key === GLOBAL_KV_SCOPE && item.kv_key === PLATFORM_BLANK_KEY,
  );
  return isPlatformBlankFlagValue(row?.value);
}

/**
 * Hard blank lock from dad_kv. While set, every device formats to $0 and cloud
 * fat uploads are scrubbed. Cleared only by persistMembersToCloud (real members).
 */
function shouldAdoptRemoteBlankPlatform(remoteKv: CloudKvRow[] = []): boolean {
  return isPlatformBlankFromKv(remoteKv);
}

function lockLocalToRemoteWipe(remoteEpoch: string | null): void {
  try {
    localStorage.setItem("dollar-a-day-factory-zero", "1");
    localStorage.setItem(PLATFORM_BLANK_KEY, "1");
    if (remoteEpoch) {
      localStorage.setItem(WORKSPACE_EPOCH_KEY, remoteEpoch);
    } else {
      bumpWorkspaceEpoch();
    }
  } catch {
    /* ignore */
  }
  purgeLocalWorkspaceArtifacts();
  pauseCloudPushes(24 * 60 * 60_000);
  blankPlatformCache = { value: true, checkedAt: Date.now() };
}

function emptyWipeBinDocument(binKey: DataBinKey, stamp: string): DataBinDocument {
  return { version: 1, binKey, updatedAt: stamp, records: [] };
}

function zeroSettingsWipeDocument(stamp: string): DataBinDocument {
  return {
    version: 1,
    binKey: "settings",
    updatedAt: stamp,
    records: [
      {
        id: "pool-live-state",
        createdAt: stamp,
        updatedAt: stamp,
        source: "platform-blank",
        payload: {
          poolSummary: {
            totalBalance: 0,
            escrowBalance: 0,
            availableToDeploy: 0,
            deployedCapital: 0,
            memberCount: 1,
            dailyInflow: 0,
            monthlyInflow: 0,
            poolApy: 0,
            lastAudit: "",
            reserveRatio: 0,
            ytdGrowthPct: 0,
          },
          poolComposition: [
            { key: "deployed", name: "Deployed", value: 0, color: "#86efac" },
            { key: "escrow", name: "Escrow", value: 0, color: "#38bdf8" },
            { key: "available", name: "Available", value: 0, color: "#a78bfa" },
          ],
          poolBalanceHistory: {
            "1d": [{ label: "Now", balance: 0 }],
            "1w": [{ label: "Today", balance: 0 }],
            "1m": [{ label: "Start", balance: 0 }],
            "1y": [{ label: "Start", balance: 0 }],
          },
          dailyAllocationSummary: {
            dateLabel: "",
            lastUpdated: "",
            lastUpdatedAt: stamp,
            totalDonations: 0,
            totalAmount: 0,
            averageDonation: 0,
            largestDonation: 0,
          },
          todaysDonations: [],
          allocationComparisons: [],
          currentMember: {
            id: "guest",
            name: "Guest",
            handle: "@guest",
            avatarInitials: "?",
            tier: "Member",
            memberSince: "",
            dailyContribution: 0,
            totalContributed: 0,
            equityValue: 0,
            streakDays: 0,
            loanEligibilityScore: 0,
            loanStatus: "pending",
            nextContributionDue: "—",
          },
          activeEasternDay: stamp.slice(0, 10),
        },
      },
    ],
  };
}

function blankDocumentForBin(binKey: DataBinKey, stamp: string): DataBinDocument {
  return binKey === "settings" ? zeroSettingsWipeDocument(stamp) : emptyWipeBinDocument(binKey, stamp);
}

function isBlankPlatformDocument(binId: string, document: DataBinDocument): boolean {
  const binKey = binKeyForBinId(binId);
  const records = Array.isArray(document?.records) ? document.records : [];
  if (!binKey) return records.length === 0;
  if (binKey !== "settings") return records.length === 0;

  if (records.length === 0) return true;
  if (records.length > 1) return false;
  const only = records[0];
  if (only?.id !== "pool-live-state") return false;
  const summary = (only.payload as { poolSummary?: Record<string, unknown> } | undefined)?.poolSummary;
  if (!summary || typeof summary !== "object") return false;
  const numericKeys = [
    "totalBalance",
    "escrowBalance",
    "availableToDeploy",
    "deployedCapital",
    "dailyInflow",
    "monthlyInflow",
  ] as const;
  return numericKeys.every((key) => Number(summary[key] ?? 0) === 0);
}

/** Force local bins to $0 — never copy fat remote bins while platform is blank. */
function applyForcedBlankBins(): void {
  const stamp = new Date().toISOString();
  beginBulkWrite();
  try {
    for (const binId of DAD_BIN_IDS) {
      const binKey = binKeyForBinId(binId);
      if (!binKey) continue;
      applyExternalBinDocument(binId, binKey, blankDocumentForBin(binKey, stamp));
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

async function setCloudPlatformBlank(epoch: string): Promise<void> {
  blankPlatformCache = { value: true, checkedAt: Date.now() };
  try {
    localStorage.setItem(PLATFORM_BLANK_KEY, "1");
  } catch {
    /* ignore */
  }
  await upsertCloudKv(GLOBAL_KV_SCOPE, PLATFORM_BLANK_KEY, "1");
  await upsertCloudKv(GLOBAL_KV_SCOPE, WORKSPACE_EPOCH_KEY, JSON.stringify(epoch));
}

export async function clearCloudPlatformBlank(): Promise<void> {
  blankPlatformCache = { value: false, checkedAt: Date.now() };
  try {
    localStorage.removeItem(PLATFORM_BLANK_KEY);
  } catch {
    /* ignore */
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase
    .from("dad_kv")
    .delete()
    .eq("workspace_id", DAD_WORKSPACE_ID)
    .eq("scope_key", GLOBAL_KV_SCOPE)
    .eq("kv_key", PLATFORM_BLANK_KEY);
  if (error) {
    console.warn("[cloudSync] Failed to clear platform blank lock:", error.message);
  }
}

async function isCloudPlatformBlank(): Promise<boolean> {
  if (blankPlatformCache && Date.now() - blankPlatformCache.checkedAt < BLANK_PLATFORM_CACHE_MS) {
    return blankPlatformCache.value;
  }
  try {
    // ONLY the explicit blank KV flag. Admin-only must NOT count as blank —
    // otherwise the first new signup is treated as a wipe target and deleted.
    const remoteKv = await fetchCloudKv();
    const blank = isPlatformBlankFromKv(remoteKv);
    blankPlatformCache = { value: blank, checkedAt: Date.now() };
    return blank;
  } catch {
    const fallback = localStorage.getItem(PLATFORM_BLANK_KEY) === "1";
    blankPlatformCache = { value: fallback, checkedAt: Date.now() };
    return fallback;
  }
}

/** Overwrite cloud bins/profiles/kv back to blank whenever a stale device raced a wipe. */
async function reassertBlankCloud(admin: DadProfile | null, epoch: string | null): Promise<void> {
  // Abort if signup/approve already opened the platform while this wipe was in-flight.
  const remoteKv = await fetchCloudKv();
  if (!isPlatformBlankFromKv(remoteKv) && localStorage.getItem(PLATFORM_BLANK_KEY) !== "1") {
    blankPlatformCache = { value: false, checkedAt: Date.now() };
    console.warn("[cloudSync] Skipping blank reassert — platform blank lock was cleared.");
    return;
  }

  // If live members already exist, never delete them — that made new signups disappear.
  const existing = await fetchCloudProfiles();
  if (existing.some((profile) => !isAdminProfile(profile))) {
    blankPlatformCache = { value: false, checkedAt: Date.now() };
    await clearCloudPlatformBlank();
    clearFactoryZeroDeliveryLock();
    console.warn("[cloudSync] Skipping blank reassert — live members already present.");
    return;
  }

  // Final race check immediately before destructive writes.
  const kvAgain = await fetchCloudKv();
  if (!isPlatformBlankFromKv(kvAgain) && localStorage.getItem(PLATFORM_BLANK_KEY) !== "1") {
    blankPlatformCache = { value: false, checkedAt: Date.now() };
    return;
  }

  const stamp = epoch || new Date().toISOString();
  await setCloudPlatformBlank(stamp);

  if (admin) {
    try {
      await replaceCloudProfilesDirectory([admin], { force: true });
    } catch (err) {
      console.warn("[cloudSync] Blank profile reassert failed:", err);
    }
  }

  await Promise.all(
    DAD_BIN_IDS.map(async (binId) => {
      const binKey = binKeyForBinId(binId);
      if (!binKey) return;
      await upsertCloudBin(binId, blankDocumentForBin(binKey, stamp), { blankWrite: true });
    }),
  );

  // Drop stale notification/DM kv that old browsers keep re-uploading.
  const supabase = getSupabaseClient();
  if (supabase) {
    for (const key of SYNCED_KV_KEYS) {
      if (key === WORKSPACE_EPOCH_KEY || key === PLATFORM_BLANK_KEY) continue;
      const { error } = await supabase
        .from("dad_kv")
        .delete()
        .eq("workspace_id", DAD_WORKSPACE_ID)
        .eq("scope_key", GLOBAL_KV_SCOPE)
        .eq("kv_key", key);
      if (error) {
        console.warn(`[cloudSync] Failed to clear stale kv ${key}:`, error.message);
      }
    }
  }
}

/** Merge local/remote profiles while dropping pre-wipe members; reopen delivery lock when new members appear. */
function mergeProfilesForWorkspace(local: DadProfile[], remote: DadProfile[]): DadProfile[] {
  // Only while the blank lock is active may we drop local-only members.
  // After the first intentional signup opens the platform, local pending members must survive
  // until their cloud upsert lands — otherwise they "disappear" on the next pull.
  const blankLocked =
    isFactoryZeroLocked() ||
    (() => {
      try {
        return localStorage.getItem(PLATFORM_BLANK_KEY) === "1";
      } catch {
        return false;
      }
    })();

  if (blankLocked && isAdminOnlyDirectory(remote)) {
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
    localStorage.removeItem(PLATFORM_BLANK_KEY);
    // Epoch was used to hide pre-wipe cloud rows; leaving it set keeps Members empty.
    localStorage.removeItem(WORKSPACE_EPOCH_KEY);
  } catch {
    /* ignore */
  }
  blankPlatformCache = { value: false, checkedAt: Date.now() };
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
  workspace_id?: string;
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
    // Required under workspace-scoped RLS (WITH CHECK workspace_id = 'dollaraday').
    workspace_id: DAD_WORKSPACE_ID,
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

  const { data, error } = await supabase
    .from("dad_profiles")
    .select("*")
    .eq("workspace_id", DAD_WORKSPACE_ID);
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
    .eq("workspace_id", DAD_WORKSPACE_ID)
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
  const blank = isPlatformBlankFromKv(rows) || isFactoryZeroLocked();

  for (const key of SYNCED_KV_KEYS) {
    // Blank platform: never restore stale notifications / DMs / locale junk from cloud.
    if (blank && key !== WORKSPACE_EPOCH_KEY && key !== PLATFORM_BLANK_KEY) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      continue;
    }

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

/** Wipe local dollar-a-day artifacts so stale browsers cannot paint old members/alerts. */
function purgeLocalWorkspaceArtifacts(): void {
  try {
    localStorage.setItem("dollar-a-day-factory-zero", "1");
    localStorage.setItem(PLATFORM_BLANK_KEY, "1");
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("dollar-a-day") && key !== "dda-locale") continue;
      if (key === "dollar-a-day-factory-zero") continue;
      if (key === PLATFORM_BLANK_KEY) continue;
      if (key === WORKSPACE_EPOCH_KEY) continue;
      if (key === "dollar-a-day-session") continue;
      if (key === "dollar-a-day-persistent-session") continue;
      if (key === "dollar-a-day-remember-login") continue;
      // Profiles scrubbed separately to admin-only.
      if (key === "dollar-a-day-profiles") continue;
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
  void import("../dadProfileStorage")
    .then(({ scrubLocalProfilesToAdminOnly }) => {
      scrubLocalProfilesToAdminOnly();
    })
    .catch(() => {});
}

async function upsertCloudBin(
  binId: string,
  document: DataBinDocument,
  options: { blankWrite?: boolean } = {},
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Hard block: stale browsers must never rewrite fat ledgers onto a blank platform.
  if (!options.blankWrite) {
    const blank = await isCloudPlatformBlank();
    if (blank && !isBlankPlatformDocument(binId, document)) {
      console.warn(
        `[cloudSync] Blocked fat bin push for ${binId} onto blank platform (stale device cache).`,
      );
      return;
    }
  }

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

  // Stale browsers must not re-upload wiped members while the cloud blank lock is set.
  // force=true is NOT enough — blank lock must be cleared first (persistMembersToCloud).
  // Note: admin-only alone is NOT used here, or first post-wipe signup could never land.
  let remoteKv: CloudKvRow[] = [];
  try {
    remoteKv = await fetchCloudKv();
  } catch {
    remoteKv = [];
  }
  if (isPlatformBlankFromKv(remoteKv)) {
    const skipped = publishProfiles.filter((profile) => !isAdminProfile(profile));
    publishProfiles = publishProfiles.filter((profile) => isAdminProfile(profile));
    if (skipped.length) {
      console.warn(
        `[cloudSync] Blocked ${skipped.length} stale member push(es) onto blank platform.`,
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
 * While the platform blank lock is set, this is a no-op unless `openPlatform: true`
 * (only new signup / admin approve|deny may open the platform).
 */
export async function persistMembersToCloud(
  profiles: DadProfile[],
  options: { openPlatform?: boolean } = {},
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  if (!profiles.length) return true;

  const blank = await isCloudPlatformBlank();
  if (blank && !options.openPlatform) {
    console.warn(
      "[cloudSync] Blocked persistMembersToCloud while blank lock is active (stale device).",
    );
    return false;
  }

  // Intentional post-wipe member write — only then open the platform blank lock.
  if (options.openPlatform) {
    clearFactoryZeroDeliveryLock();
    await clearCloudPlatformBlank();
    blankPlatformCache = { value: false, checkedAt: Date.now() };
  }
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
        const { error } = await supabase
          .from("dad_profiles")
          .delete()
          .eq("workspace_id", DAD_WORKSPACE_ID)
          .in("id", chunk);
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
      const { error } = await supabase
        .from("dad_profiles")
        .delete()
        .eq("workspace_id", DAD_WORKSPACE_ID)
        .in("id", chunk);
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

  // 2) Clear synced kv noise, then set cloud-wide blank lock + epoch.
  for (const key of SYNCED_KV_KEYS) {
    if (key === WORKSPACE_EPOCH_KEY || key === PLATFORM_BLANK_KEY) continue;
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
  await setCloudPlatformBlank(epoch);

  // 3) Force-write blank bins (blankWrite bypasses the blank-platform push guard).
  const wipedStamp = new Date().toISOString();
  await Promise.all(
    DATA_BIN_DEFINITIONS.map((definition) =>
      upsertCloudBin(definition.binId, blankDocumentForBin(definition.key, wipedStamp), {
        blankWrite: true,
      }),
    ),
  );
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
  const [remote, remoteKv] = await Promise.all([fetchCloudProfiles(), fetchCloudKv()]);
  const remoteEpoch = getRemoteWorkspaceEpoch(remoteKv);

  // Hard blank lock: format this browser to $0 and scrub any raced fat cloud uploads.
  if (shouldAdoptRemoteBlankPlatform(remoteKv)) {
    applyKvToLocalStorage(remoteKv);
    lockLocalToRemoteWipe(remoteEpoch);
    applyForcedBlankBins();
    try {
      const { scrubLocalProfilesToAdminOnly } = await import("../dadProfileStorage");
      scrubLocalProfilesToAdminOnly();
    } catch {
      /* ignore */
    }
    const adminOnly = remote.filter((profile) => isAdminProfile(profile)).slice(0, 1);
    replaceLocalProfiles(adminOnly);
    refreshUiAfterLocalWipe();
    void reassertBlankCloud(adminOnly[0] ?? null, remoteEpoch).catch((err) =>
      console.warn("[cloudSync] Blank cloud reassert after pull failed:", err),
    );
    return adminOnly;
  }

  // Open platform (blank lock cleared): merge normally so brand-new local signups
  // are not deleted while their cloud upsert is still in flight.

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
 * Auth-screen fast path: refresh one username from cloud without resurrecting
 * the rest of a stale local directory.
 */
export async function pullCloudProfileForAuth(
  username: string,
  getLocalProfiles: () => DadProfile[],
  replaceLocalProfiles: (profiles: DadProfile[]) => void,
): Promise<DadProfile[]> {
  if (!isSupabaseConfigured()) return getLocalProfiles();

  const remoteKv = await fetchCloudKv();
  const remoteEpoch = getRemoteWorkspaceEpoch(remoteKv);

  // Always try the username first. A stale blank lock must not hide an approved
  // member that already exists in cloud (create→approve→login on another device).
  const remoteProfile = await fetchCloudProfileByUsername(username);
  if (remoteProfile && !isAdminProfile(remoteProfile)) {
    // Local blank/factory-zero locks strip non-admin rows in writeProfiles/readProfiles.
    // Signup clears them before write; login must too or auth sees "invalid password".
    clearFactoryZeroDeliveryLock();
    if (isPlatformBlankFromKv(remoteKv)) {
      await clearCloudPlatformBlank();
    }

    const localProfiles = getLocalProfiles();
    const remoteId = remoteProfile.id;
    const remoteUser = remoteProfile.username.trim().toLowerCase();
    const withoutStale = localProfiles.filter(
      (profile) =>
        profile.id !== remoteId && profile.username.trim().toLowerCase() !== remoteUser,
    );
    const next = [
      ...withoutStale,
      {
        ...remoteProfile,
        approvalStatus: remoteProfile.approvalStatus,
        accountStatus: remoteProfile.accountStatus,
        password: remoteProfile.password,
      },
    ];
    replaceLocalProfiles(next);
    return next;
  }

  // No cloud member for this username: blank lock may scrub stale local leftovers.
  if (shouldAdoptRemoteBlankPlatform(remoteKv)) {
    lockLocalToRemoteWipe(remoteEpoch);
    applyForcedBlankBins();
    try {
      const { scrubLocalProfilesToAdminOnly } = await import("../dadProfileStorage");
      scrubLocalProfilesToAdminOnly();
    } catch {
      /* ignore */
    }
    const remoteProfiles = await fetchCloudProfiles();
    const adminOnly = remoteProfiles.filter((profile) => isAdminProfile(profile)).slice(0, 1);
    replaceLocalProfiles(adminOnly);
    refreshUiAfterLocalWipe();
    void reassertBlankCloud(adminOnly[0] ?? null, remoteEpoch).catch(() => {});
    return adminOnly;
  }

  return getLocalProfiles();
}

async function upsertCloudKv(scopeKey: string, kvKey: string, rawValue: string | null): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || rawValue == null) return;

  // Blank lock: only wipe epoch / blank flag may be written. Stale DM/notification
  // caches from old browsers were reappearing through this path.
  if (kvKey !== WORKSPACE_EPOCH_KEY && kvKey !== PLATFORM_BLANK_KEY) {
    const blank = await isCloudPlatformBlank();
    if (blank) {
      console.warn(`[cloudSync] Blocked kv push for ${kvKey} onto blank platform.`);
      return;
    }
  }

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

    // Hard blank lock: format every device to $0 and scrub any raced fat uploads.
    if (shouldAdoptRemoteBlankPlatform(remoteKv)) {
      applyKvToLocalStorage(remoteKv);
      lockLocalToRemoteWipe(remoteEpoch);
      applyForcedBlankBins();

      const adminOnly = remoteProfiles.filter((profile) => isAdminProfile(profile)).slice(0, 1);
      options.replaceLocalProfiles(adminOnly);
      refreshUiAfterLocalWipe();

      try {
        await reassertBlankCloud(adminOnly[0] ?? null, remoteEpoch);
      } catch (err) {
        console.warn("[cloudSync] Blank cloud reassert failed:", err);
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
      {
        event: "*",
        schema: "public",
        table: "dad_profiles",
        filter: `workspace_id=eq.${DAD_WORKSPACE_ID}`,
      },
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
