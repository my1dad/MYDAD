import {
  ADMIN_ROLE,
  ADMIN_USERNAME,
  ADMIN_WORKSPACE_NAME,
} from "../../config/admin";
import { DATA_BIN_DEFINITIONS } from "./dataBins";
import {
  clearAllDadProfiles,
  ensureDadAdminProfile,
  findMasterAdminProfile,
  replaceDadProfilesLocal,
  setDadSessionId,
  type DadProfile,
} from "./dadProfileStorage";
import { resetAppSettings } from "./appSettings";
import {
  flushInternalDatabase,
  readDataBin,
  replaceDataBinNow,
  requestFactoryZeroDisk,
} from "./internalDatabase";
import { resetPoolStateToSeed, syncPoolCapitalFromLedger } from "./poolState";
import { invalidateMemberAccountsCache } from "./memberAccounts";
import {
  bumpWorkspaceEpoch,
  pauseCloudPushes,
  wipeCloudWorkspaceExceptAdmin,
  WORKSPACE_EPOCH_KEY,
} from "./supabase/cloudSync";

const PROFILES_KEY = "dollar-a-day-profiles";
const SESSION_KEY = "dollar-a-day-session";
const PERSISTENT_SESSION_KEY = "dollar-a-day-persistent-session";

function clearDadLocalStorageKeys(preserveKeys: string[] = []): void {
  const preserve = new Set(preserveKeys);
  Object.keys(localStorage)
    .filter((key) => key.startsWith("dollar-a-day") && !preserve.has(key))
    .forEach((key) => localStorage.removeItem(key));
}

function snapshotMasterAdmin(admin: DadProfile | undefined): DadProfile | null {
  if (!admin) return null;
  const now = new Date().toISOString();
  return {
    ...admin,
    username: ADMIN_USERNAME,
    role: admin.role?.trim() || ADMIN_ROLE,
    fullName: admin.fullName?.trim() || ADMIN_ROLE,
    displayName: admin.displayName?.trim() || ADMIN_WORKSPACE_NAME,
    approvalStatus: "approved",
    accountStatus: "active",
    updatedAt: now,
  };
}

function wipeAllDataBins(wipedAt: string): void {
  for (const definition of DATA_BIN_DEFINITIONS) {
    replaceDataBinNow(definition.key, {
      version: 1,
      binKey: definition.key,
      updatedAt: wipedAt,
      records: [],
    });
  }
}

function restampAllDataBins(stamp: string): void {
  for (const definition of DATA_BIN_DEFINITIONS) {
    const current = readDataBin(definition.key);
    replaceDataBinNow(definition.key, {
      ...current,
      binKey: definition.key,
      updatedAt: stamp,
      records: Array.isArray(current.records) ? current.records : [],
    });
  }
}

export async function resetLiquidityPool(): Promise<void> {
  const { clearDataBin } = await import("./internalDatabase");
  clearDataBin("contributions");
  resetPoolStateToSeed();
  syncPoolCapitalFromLedger();
  await flushInternalDatabase();
}

export async function resetWorkspaceForBacktest(): Promise<void> {
  const { clearDataBin } = await import("./internalDatabase");
  for (const bin of DATA_BIN_DEFINITIONS) {
    clearDataBin(bin.key);
  }

  clearAllDadProfiles();
  setDadSessionId(null);
  resetPoolStateToSeed();
  syncPoolCapitalFromLedger();

  await flushInternalDatabase();
}

/**
 * Factory-reset: wipe all balances, ledgers, members, transactions (local + Supabase).
 * Master admin remains signed in at $0.
 */
export async function masterResetDashboard(): Promise<void> {
  const preservedAdmin = snapshotMasterAdmin(findMasterAdminProfile());

  // Stop cloud/disk races while we wipe. Lock disk so old PUTs cannot restore balances.
  pauseCloudPushes(24 * 60 * 60_000);
  await requestFactoryZeroDisk();

  sessionStorage.clear();
  clearAllDadProfiles();
  clearDadLocalStorageKeys([WORKSPACE_EPOCH_KEY]);
  clearAllDadProfiles();
  resetAppSettings();
  invalidateMemberAccountsCache();

  try {
    localStorage.setItem("dollar-a-day-factory-zero", "1");
  } catch {
    /* ignore */
  }

  const epoch = bumpWorkspaceEpoch();
  wipeAllDataBins(epoch);
  resetPoolStateToSeed();
  syncPoolCapitalFromLedger();
  restampAllDataBins(new Date().toISOString());

  let admin = preservedAdmin;
  if (admin) {
    replaceDadProfilesLocal([admin]);
  } else {
    admin = await ensureDadAdminProfile();
    const onlyAdmin = findMasterAdminProfile();
    if (onlyAdmin) {
      replaceDadProfilesLocal([onlyAdmin]);
      admin = onlyAdmin;
    }
  }

  setDadSessionId(admin.id);

  // Persist wiped bins to disk + localStorage before any cloud I/O.
  await flushInternalDatabase();
  // Re-lock / re-seed disk after flush (flush may have been partially blocked).
  await requestFactoryZeroDisk();

  try {
    await wipeCloudWorkspaceExceptAdmin(admin);
  } catch (err) {
    console.error("[workspaceReset] Cloud wipe failed:", err);
    throw err instanceof Error
      ? err
      : new Error("Cloud wipe failed — platform data may still exist in Supabase.");
  }

  // Re-assert $0 after cloud round-trip (guards against remote merge races).
  invalidateMemberAccountsCache();
  wipeAllDataBins(new Date().toISOString());
  resetPoolStateToSeed();
  syncPoolCapitalFromLedger();
  restampAllDataBins(new Date().toISOString());
  replaceDadProfilesLocal([admin]);
  setDadSessionId(admin.id);

  try {
    if (!localStorage.getItem(PROFILES_KEY)) {
      replaceDadProfilesLocal([admin]);
    }
    if (!localStorage.getItem(SESSION_KEY) && !localStorage.getItem(PERSISTENT_SESSION_KEY)) {
      setDadSessionId(admin.id);
    }
  } catch {
    /* ignore */
  }

  await flushInternalDatabase();
  await requestFactoryZeroDisk();

  // Push the final $0 bins to cloud again so nothing stale remains.
  try {
    await wipeCloudWorkspaceExceptAdmin(admin);
  } catch (err) {
    console.warn("[workspaceReset] Final cloud re-wipe failed:", err);
  }
}
