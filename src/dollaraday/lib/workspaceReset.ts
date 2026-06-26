import { DATA_BIN_DEFINITIONS } from "./dataBins";
import {
  clearAllDadProfiles,
  ensureDadAdminProfile,
  setDadSessionId,
} from "./dadProfileStorage";
import { resetAppSettings } from "./appSettings";
import { clearDataBin, flushInternalDatabase } from "./internalDatabase";
import { resetPoolStateToSeed } from "./poolState";

function clearDadLocalStorageKeys(): void {
  Object.keys(localStorage)
    .filter((key) => key.startsWith("dollar-a-day"))
    .forEach((key) => localStorage.removeItem(key));
}

export async function resetLiquidityPool(): Promise<void> {
  clearDataBin("contributions");
  resetPoolStateToSeed();
  await flushInternalDatabase();
}

export async function resetWorkspaceForBacktest(): Promise<void> {
  for (const bin of DATA_BIN_DEFINITIONS) {
    clearDataBin(bin.key);
  }

  clearAllDadProfiles();
  setDadSessionId(null);
  resetPoolStateToSeed();

  await flushInternalDatabase();
}

/** Wipes all dashboard data on this device and restores factory defaults. */
export async function masterResetDashboard(): Promise<void> {
  sessionStorage.clear();
  clearDadLocalStorageKeys();
  resetAppSettings();

  for (const bin of DATA_BIN_DEFINITIONS) {
    clearDataBin(bin.key);
  }

  resetPoolStateToSeed();
  ensureDadAdminProfile();
  setDadSessionId(null);

  await flushInternalDatabase();
}
