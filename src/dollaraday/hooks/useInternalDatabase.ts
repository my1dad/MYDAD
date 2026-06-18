import { useEffect, useState, useSyncExternalStore } from "react";
import {
  appendDataRecord,
  clearDataBin,
  flushInternalDatabase,
  getDatabaseSnapshot,
  getBinsRoot,
  getStorageMode,
  isInternalDatabaseReady,
  subscribeInternalDatabase,
  upsertDataRecord,
  writeDataBin,
  type DataBinKey,
} from "../lib/internalDatabase";

function getServerSnapshot() {
  return getDatabaseSnapshot();
}

export function useInternalDatabase() {
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getServerSnapshot
  );

  const [ready, setReady] = useState(isInternalDatabaseReady());

  useEffect(() => {
    setReady(isInternalDatabaseReady());
  }, [snapshot.syncedAt]);

  return {
    ready,
    snapshot,
    mode: getStorageMode(),
    binsRoot: getBinsRoot(),
    appendRecord: appendDataRecord,
    upsertRecord: upsertDataRecord,
    writeBin: writeDataBin,
    clearBin: clearDataBin,
    flush: flushInternalDatabase,
  };
}

export function useDataBin(key: DataBinKey) {
  const { snapshot, appendRecord, clearBin } = useInternalDatabase();
  return {
    document: snapshot.bins[key],
    records: snapshot.bins[key]?.records ?? [],
    appendRecord: (source: string, payload: Record<string, unknown>) =>
      appendRecord(key, source, payload),
    clearBin: () => clearBin(key),
  };
}
