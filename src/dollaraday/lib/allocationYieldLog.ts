import type { AllocationSleeveKey } from "./allocationPurchases";
import { formatEasternIsoDate } from "./dateTime";
import { readDataBin, subscribeInternalDatabase, upsertDataRecord } from "./internalDatabase";
import { roundYieldCurrency } from "./allocationInstruments";

export interface AllocationYieldLogEntry {
  id: string;
  positionId: string;
  profileId: string;
  sleeveKey: AllocationSleeveKey;
  contractLabel: string;
  dayYmd: string;
  returnPct: number;
  amount: number;
  principalBefore: number;
  principalAfter: number;
  createdAt: string;
}

interface YieldLogPayload {
  entries: AllocationYieldLogEntry[];
}

const YIELD_LOG_RECORD_ID = "allocation-yield-log";
const MAX_ENTRIES = 400;

function readPayload(): YieldLogPayload {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === YIELD_LOG_RECORD_ID);
  const payload = record?.payload as Partial<YieldLogPayload> | undefined;
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  return { entries };
}

export function appendAllocationYieldLogEntry(
  entry: Omit<AllocationYieldLogEntry, "id" | "createdAt">,
): AllocationYieldLogEntry {
  const stored: AllocationYieldLogEntry = {
    ...entry,
    id: `yield-${entry.positionId}-${entry.dayYmd}`,
    createdAt: `${entry.dayYmd}T16:00:00.000Z`,
  };

  const payload = readPayload();
  const withoutDuplicate = payload.entries.filter((item) => item.id !== stored.id);
  const entries = [stored, ...withoutDuplicate].slice(0, MAX_ENTRIES);

  upsertDataRecord("settings", YIELD_LOG_RECORD_ID, "allocation-yield-log", { entries });
  return stored;
}

export function getAllocationYieldLogEntries(limit = MAX_ENTRIES): AllocationYieldLogEntry[] {
  return readPayload().entries.slice(0, limit);
}

export function getYieldLogEntriesSince(dayYmd: string): AllocationYieldLogEntry[] {
  return readPayload().entries.filter((entry) => entry.dayYmd >= dayYmd);
}

export function getLatestDailyReturnPctBySleeve(
  sleeveKey: AllocationSleeveKey,
): number | null {
  const entries = readPayload().entries.filter((entry) => entry.sleeveKey === sleeveKey);
  if (!entries.length) return null;

  const latestDay = entries.reduce((max, entry) => (entry.dayYmd > max ? entry.dayYmd : max), "");
  const dayEntries = entries.filter((entry) => entry.dayYmd === latestDay);
  const totalPrincipal = dayEntries.reduce((sum, entry) => sum + entry.principalBefore, 0);
  if (totalPrincipal <= 0) return null;

  const weighted = dayEntries.reduce(
    (sum, entry) => sum + entry.returnPct * entry.principalBefore,
    0,
  );
  return roundYieldCurrency(weighted / totalPrincipal);
}

export function getTrailingAnnualizedApy(days = 30): number | null {
  const entries = readPayload().entries;
  if (!entries.length) return null;

  const uniqueDays = [...new Set(entries.map((entry) => entry.dayYmd))].sort().slice(-days);
  if (!uniqueDays.length) return null;

  const recent = entries.filter((entry) => uniqueDays.includes(entry.dayYmd));
  const totalPrincipal = recent.reduce((sum, entry) => sum + entry.principalBefore, 0);
  if (totalPrincipal <= 0) return null;

  const weightedDaily = recent.reduce(
    (sum, entry) => sum + entry.returnPct * entry.principalBefore,
    0,
  ) / totalPrincipal;

  return roundYieldCurrency(weightedDaily * 365);
}

export function getYtdCompoundReturnPct(): number {
  const yearPrefix = formatEasternIsoDate().slice(0, 4);
  const entries = readPayload().entries.filter((entry) => entry.dayYmd.startsWith(yearPrefix));
  if (!entries.length) return 0;

  let compound = 1;
  const byDay = new Map<string, AllocationYieldLogEntry[]>();
  entries.forEach((entry) => {
    const bucket = byDay.get(entry.dayYmd) ?? [];
    bucket.push(entry);
    byDay.set(entry.dayYmd, bucket);
  });

  [...byDay.keys()].sort().forEach((dayYmd) => {
    const dayEntries = byDay.get(dayYmd) ?? [];
    const totalPrincipal = dayEntries.reduce((sum, entry) => sum + entry.principalBefore, 0);
    if (totalPrincipal <= 0) return;
    const weightedDaily =
      dayEntries.reduce((sum, entry) => sum + entry.returnPct * entry.principalBefore, 0) /
      totalPrincipal;
    compound *= 1 + weightedDaily / 100;
  });

  return roundYieldCurrency((compound - 1) * 100);
}

export function subscribeAllocationYieldLog(listener: () => void): () => void {
  return subscribeInternalDatabase(listener);
}
