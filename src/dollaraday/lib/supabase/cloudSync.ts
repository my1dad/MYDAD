import type { RealtimeChannel } from "@supabase/supabase-js";
import { DAD_BIN_IDS, DAD_STORAGE_PROFILE_ID, DATA_BIN_DEFINITIONS, type DataBinKey } from "../dataBins";
import type { DadProfile } from "../dadProfileStorage";
import {
  applyExternalBinDocument,
  readDataBin,
  type DataBinDocument,
} from "../internalDatabase";
import { DAD_WORKSPACE_ID, getSupabaseClient, isSupabaseConfigured } from "./client";

const CLOUD_PUSH_DEBOUNCE_MS = 400;
const GLOBAL_KV_SCOPE = "global";

/** localStorage keys synced to dad_kv (excluding profiles & session keys). */
export const SYNCED_KV_KEYS = [
  "dollar-a-day-app-settings",
  "dollar-a-day-notification-read",
  "dollar-a-day-notification-dismissed",
  "dollar-a-day-dm-read",
  "dda-locale",
] as const;

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
): { merged: DataBinDocument; source: "local" | "remote" | "empty" } {
  if (!remote?.updatedAt) {
    return { merged: local ?? remote!, source: local ? "local" : "empty" };
  }
  if (!local?.updatedAt) {
    return { merged: remote, source: "remote" };
  }
  if (remote.updatedAt >= local.updatedAt) {
    return { merged: remote, source: "remote" };
  }
  return { merged: local, source: "local" };
}

function mergeProfiles(local: DadProfile[], remote: DadProfile[]): DadProfile[] {
  const map = new Map<string, DadProfile>();
  for (const profile of remote) map.set(profile.id, profile);
  for (const profile of local) {
    const existing = map.get(profile.id);
    const localTs = profile.updatedAt ?? profile.lastLoginAt ?? profile.createdAt;
    const remoteTs = existing?.updatedAt ?? existing?.lastLoginAt ?? existing?.createdAt ?? "";
    if (!existing || localTs >= remoteTs) {
      map.set(profile.id, profile);
    }
  }
  return Array.from(map.values());
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

async function upsertCloudProfiles(profiles: DadProfile[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || !profiles.length) return;

  const rows = profiles.map(profileToRow);
  const { error } = await supabase.from("dad_profiles").upsert(rows, { onConflict: "id" });
  if (error) console.warn("[cloudSync] Failed to push profiles:", error.message);
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
  if (!isSupabaseConfigured()) return;

  const existing = pendingBinPushes.get(binId);
  if (existing) clearTimeout(existing);

  pendingBinPushes.set(
    binId,
    setTimeout(() => {
      pendingBinPushes.delete(binId);
      void upsertCloudBin(binId, document);
    }, CLOUD_PUSH_DEBOUNCE_MS),
  );
}

export function scheduleCloudProfilesPush(profiles: DadProfile[]): void {
  if (!isSupabaseConfigured()) return;

  if (pendingProfilePush) clearTimeout(pendingProfilePush);
  pendingProfilePush = setTimeout(() => {
    pendingProfilePush = null;
    void upsertCloudProfiles(profiles);
  }, CLOUD_PUSH_DEBOUNCE_MS);
}

export function scheduleCloudKvPush(kvKey: SyncedKvKey): void {
  if (!isSupabaseConfigured()) return;

  const existing = pendingKvPushes.get(kvKey);
  if (existing) clearTimeout(existing);

  pendingKvPushes.set(
    kvKey,
    setTimeout(() => {
      pendingKvPushes.delete(kvKey);
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

    for (const binId of DAD_BIN_IDS) {
      const binKey = binKeyForBinId(binId);
      if (!binKey) continue;

      const remoteRow = remoteBins.find((row) => row.bin_id === binId);
      const localDoc = readDataBin(binKey);
      const { merged, source } = mergeBinDocuments(localDoc, remoteRow?.document ?? null);

      applyExternalBinDocument(binId, binKey, merged);

      // Seed empty cloud, or push local wins so every device shares one workspace.
      if (cloudEmpty || source === "local") {
        await upsertCloudBin(binId, merged);
      }
    }

    const localProfiles = options.getLocalProfiles();
    const mergedProfiles = mergeProfiles(localProfiles, remoteProfiles);
    options.replaceLocalProfiles(mergedProfiles);

    // Always publish the merged profile directory so master admin sees every member worldwide.
    if (mergedProfiles.length > 0) {
      await upsertCloudProfiles(mergedProfiles);
    }

    applyKvToLocalStorage(remoteKv);

    for (const key of SYNCED_KV_KEYS) {
      const localRaw = localStorage.getItem(key);
      const remote = remoteKv.find((row) => row.scope_key === GLOBAL_KV_SCOPE && row.kv_key === key);
      if (localRaw && (!remote || cloudEmpty)) {
        await upsertCloudKv(GLOBAL_KV_SCOPE, key, localRaw);
      }
    }

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
  applyExternalBinDocument(binId, binKey, document);
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
        const remote = await fetchCloudProfiles();
        const merged = mergeProfiles(options.getLocalProfiles(), remote);
        options.onProfilesChanged(merged);
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

  await syncCloudWorkspace(options);
  cloudInitialized = true;
  notifyCloudStatusListeners();

  // Periodic pull keeps worldwide logins and admin views consistent if realtime drops.
  const pollId = window.setInterval(() => {
    void syncCloudWorkspace(options);
  }, 45_000);

  const stopRealtime = startCloudRealtime({
    getLocalProfiles: options.getLocalProfiles,
    onProfilesChanged: options.onProfilesChanged,
  });

  return () => {
    window.clearInterval(pollId);
    stopRealtime();
  };
}
