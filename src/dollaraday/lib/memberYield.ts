import { useMemo, useSyncExternalStore } from "react";
import { isAdminProfile } from "../../config/admin";
import { formatEasternIsoDate } from "./dateTime";
import { getActiveDadProfile, subscribeDadProfiles, getDadProfileRevision } from "./dadProfileStorage";
import {
  getDatabaseRevision,
  readDataBin,
  subscribeInternalDatabase,
  upsertDataRecord,
  type DataBinDocument,
  type StoredRecord,
} from "./internalDatabase";
import { computeMemberStatsFromContributions } from "./memberContributionStats";
import { getRegisteredMembers } from "./memberRegistry";

const YIELD_RECORD_ID = "member-yield-schedules";
const YIELD_RECORD_SOURCE = "member-yield-schedules";

/** Average month length so daily × (365/12) matches a monthly period. */
const DAYS_PER_MONTH = 365 / 12;
const MS_PER_DAY = 86_400_000;

export type YieldInterval = "daily" | "weekly" | "monthly";

export interface MemberYieldSchedule {
  percent: number;
  interval: YieldInterval;
  /** ISO timestamp when this percent and interval were saved. */
  setAt: string;
}

export interface MemberYieldQuote {
  daily: number;
  monthly: number;
  ytdGain: number;
  ytdPct: number;
}

export interface PlatformYieldTotals {
  daily: number;
  monthly: number;
  ytdGain: number;
}

const EMPTY_QUOTE: MemberYieldQuote = {
  daily: 0,
  monthly: 0,
  ytdGain: 0,
  ytdPct: 0,
};

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function isYieldInterval(value: unknown): value is YieldInterval {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function periodLengthDays(interval: YieldInterval): number {
  if (interval === "daily") return 1;
  if (interval === "weekly") return 7;
  return DAYS_PER_MONTH;
}

/** January 1 00:00 America/New_York. January is always EST (UTC−5). */
function startOfEasternYearMs(now: Date): number {
  const year = Number(formatEasternIsoDate(now).slice(0, 4));
  if (!Number.isFinite(year)) return Date.UTC(now.getUTCFullYear(), 0, 1, 5, 0, 0, 0);
  return Date.UTC(year, 0, 1, 5, 0, 0, 0);
}

function parseSchedule(value: unknown): MemberYieldSchedule | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const percent = Number(record.percent);
  if (!Number.isFinite(percent) || percent < 0) return null;
  if (!isYieldInterval(record.interval)) return null;
  const setAt = typeof record.setAt === "string" ? record.setAt : "";
  if (!setAt || Number.isNaN(Date.parse(setAt))) return null;
  return { percent, interval: record.interval, setAt };
}

function schedulesFromPayload(payload: unknown): Record<string, MemberYieldSchedule> {
  if (!payload || typeof payload !== "object") return {};
  const raw = (payload as Record<string, unknown>).schedules;
  if (!raw || typeof raw !== "object") return {};

  const schedules: Record<string, MemberYieldSchedule> = {};
  for (const [profileId, value] of Object.entries(raw as Record<string, unknown>)) {
    const schedule = parseSchedule(value);
    if (!profileId || !schedule) continue;
    schedules[profileId] = schedule;
  }
  return schedules;
}

function readSchedules(): Record<string, MemberYieldSchedule> {
  const record = readDataBin("settings").records.find((item) => item.id === YIELD_RECORD_ID);
  return schedulesFromPayload(record?.payload);
}

function schedulesEqual(
  left: Record<string, MemberYieldSchedule>,
  right: Record<string, MemberYieldSchedule>,
): boolean {
  const leftIds = Object.keys(left);
  if (leftIds.length !== Object.keys(right).length) return false;
  return leftIds.every((profileId) => {
    const other = right[profileId];
    const schedule = left[profileId];
    return (
      other != null &&
      schedule.percent === other.percent &&
      schedule.interval === other.interval &&
      schedule.setAt === other.setAt
    );
  });
}

/**
 * Keep each member's newer saved rate when a cloud settings document arrives.
 * The settings bin is replaced as a whole, so an older copy would otherwise
 * clear a rate the admin just saved.
 */
export function mergeYieldIntoSettingsDocument(remote: DataBinDocument): DataBinDocument {
  const localSchedules = readSchedules();
  const records = Array.isArray(remote?.records) ? remote.records : [];
  const remoteRecord = records.find((item) => item.id === YIELD_RECORD_ID);
  const remoteSchedules = schedulesFromPayload(remoteRecord?.payload);
  if (schedulesEqual(localSchedules, remoteSchedules)) return remote;

  const merged: Record<string, MemberYieldSchedule> = { ...remoteSchedules };
  for (const [profileId, local] of Object.entries(localSchedules)) {
    const remoteSchedule = remoteSchedules[profileId];
    const localMs = Date.parse(local.setAt);
    const remoteMs = remoteSchedule ? Date.parse(remoteSchedule.setAt) : Number.NaN;
    if (
      !remoteSchedule ||
      (Number.isFinite(localMs) && (!Number.isFinite(remoteMs) || localMs >= remoteMs))
    ) {
      merged[profileId] = local;
    }
  }
  if (schedulesEqual(merged, remoteSchedules)) return remote;

  const now = new Date().toISOString();
  const payload = { ...(remoteRecord?.payload ?? {}), schedules: merged };
  const nextRecord: StoredRecord = remoteRecord
    ? { ...remoteRecord, source: YIELD_RECORD_SOURCE, payload, updatedAt: now }
    : {
        id: YIELD_RECORD_ID,
        createdAt: now,
        updatedAt: now,
        source: YIELD_RECORD_SOURCE,
        payload,
      };
  const nextRecords = remoteRecord
    ? records.map((item) => (item.id === YIELD_RECORD_ID ? nextRecord : item))
    : [nextRecord, ...records];
  return { ...remote, records: nextRecords, updatedAt: now };
}

export function getMemberYieldSchedule(profileId: string): MemberYieldSchedule | null {
  if (!profileId) return null;
  return readSchedules()[profileId] ?? null;
}

/**
 * Dollar yield for one balance and schedule.
 * Daily/monthly are forward estimates. YTD compounds from the later of
 * January 1 and the day the rate was saved.
 */
export function quoteMemberYield(
  balance: number,
  schedule: MemberYieldSchedule | null | undefined,
  now: Date = new Date(),
): MemberYieldQuote {
  const principal = Math.max(0, Number(balance) || 0);
  const percent = Number(schedule?.percent) || 0;
  if (!schedule || principal <= 0 || percent <= 0) return { ...EMPTY_QUOTE };

  const periodRate = percent / 100;
  const periodDays = periodLengthDays(schedule.interval);
  const daily = principal * periodRate / periodDays;
  const monthly = daily * DAYS_PER_MONTH;

  const setMs = Date.parse(schedule.setAt);
  const startMs = Math.max(startOfEasternYearMs(now), Number.isFinite(setMs) ? setMs : now.getTime());
  const elapsedDays = (now.getTime() - startMs) / MS_PER_DAY;
  const periods = elapsedDays / periodDays;
  const growth = periods > 0 ? (1 + periodRate) ** periods - 1 : 0;

  return {
    daily: roundMoney(daily),
    monthly: roundMoney(monthly),
    ytdGain: roundMoney(principal * growth),
    ytdPct: roundPercent(growth * 100),
  };
}

export function getMemberYieldQuote(profileId: string, now: Date = new Date()): MemberYieldQuote {
  if (!profileId) return { ...EMPTY_QUOTE };
  const schedule = getMemberYieldSchedule(profileId);
  if (!schedule) return { ...EMPTY_QUOTE };
  const balance = computeMemberStatsFromContributions(profileId).equity;
  return quoteMemberYield(balance, schedule, now);
}

export function getPlatformYieldTotals(now: Date = new Date()): PlatformYieldTotals {
  const schedules = readSchedules();
  let daily = 0;
  let monthly = 0;
  let ytdGain = 0;

  for (const member of getRegisteredMembers()) {
    const profileId = member.profileId ?? member.id;
    const schedule = schedules[profileId];
    if (!schedule || schedule.percent <= 0) continue;
    const balance = computeMemberStatsFromContributions(profileId).equity;
    const quote = quoteMemberYield(balance, schedule, now);
    daily += quote.daily;
    monthly += quote.monthly;
    ytdGain += quote.ytdGain;
  }

  return {
    daily: roundMoney(daily),
    monthly: roundMoney(monthly),
    ytdGain: roundMoney(ytdGain),
  };
}

export function saveMemberYieldSchedule(
  profileId: string,
  percent: number,
  interval: YieldInterval,
): { ok: true } | { ok: false; error: string } {
  const actor = getActiveDadProfile();
  if (!isAdminProfile(actor)) {
    return { ok: false, error: "master-admin-only" };
  }
  if (!profileId) return { ok: false, error: "missing-profile" };
  if (!Number.isFinite(percent) || percent < 0) return { ok: false, error: "invalid-percent" };
  if (!isYieldInterval(interval)) return { ok: false, error: "invalid-interval" };

  const rounded = Math.round(percent * 10000) / 10000;
  const schedules = readSchedules();
  const previous = schedules[profileId];
  const unchanged =
    previous != null && previous.percent === rounded && previous.interval === interval;
  const setAt = unchanged ? previous.setAt : new Date().toISOString();

  upsertDataRecord("settings", YIELD_RECORD_ID, YIELD_RECORD_SOURCE, {
    schedules: {
      ...schedules,
      [profileId]: { percent: rounded, interval, setAt },
    },
  });

  return { ok: true };
}

export function usePlatformYieldTotals(): PlatformYieldTotals {
  const dbRevision = useSyncExternalStore(subscribeInternalDatabase, getDatabaseRevision, () => 0);
  const profileRevision = useSyncExternalStore(subscribeDadProfiles, getDadProfileRevision, () => 0);

  return useMemo(() => {
    void dbRevision;
    void profileRevision;
    return getPlatformYieldTotals();
  }, [dbRevision, profileRevision]);
}

export function useMemberYieldQuote(profileId: string | undefined): MemberYieldQuote {
  const dbRevision = useSyncExternalStore(subscribeInternalDatabase, getDatabaseRevision, () => 0);
  const profileRevision = useSyncExternalStore(subscribeDadProfiles, getDadProfileRevision, () => 0);

  return useMemo(() => {
    void dbRevision;
    void profileRevision;
    if (!profileId) return { ...EMPTY_QUOTE };
    return getMemberYieldQuote(profileId);
  }, [dbRevision, profileRevision, profileId]);
}
