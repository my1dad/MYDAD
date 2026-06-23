import { DATA_BIN_DEFINITIONS } from "./dataBins";
import { clearAllDadProfiles, setDadSessionId } from "./dadProfileStorage";
import { clearDataBin, flushInternalDatabase } from "./internalDatabase";
import { resetPoolStateToSeed } from "./poolState";

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
