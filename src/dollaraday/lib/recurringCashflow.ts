import { useSyncExternalStore } from "react";
import {
  easternDateAt,
  easternNow,
  formatEasternIsoDate,
  getEasternYmd,
} from "./dateTime";
import { readDataBin, subscribeInternalDatabase, upsertDataRecord } from "./internalDatabase";
import {
  depositToMemberAccount,
  hydrateMemberAccounts,
  invalidateMemberAccountsCache,
  resolveMemberProfileId,
  spendFromMemberAccount,
  transferBetweenMemberAccounts,
  type MemberAccountId,
} from "./memberAccounts";
import { rolloverEasternDayIfNeeded } from "./poolState";

export type RecurringFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
export type RecurringCashflowType = "income" | "expense" | "transfer";

export interface RecurringCashflow {
  id: string;
  profileId: string;
  accountId: MemberAccountId;
  transferToAccountId?: MemberAccountId;
  type: RecurringCashflowType;
  amount: number;
  frequency: RecurringFrequency;
  label: string;
  enabled: boolean;
  startDate: string;
  lastProcessedDate: string;
  /** Explicitly settled occurrence dates (YMD), including manual pay-now. */
  settledDates?: string[];
  createdAt: string;
}

interface RecurringCashflowsPayload {
  schedules: RecurringCashflow[];
}

export const RECURRING_CASHFLOWS_ID = "recurring-cashflows";
const CHECK_INTERVAL_MS = 15_000;
const MAX_CATCH_UP = 30;
const EMPTY_SCHEDULES: RecurringCashflow[] = [];

const listeners = new Set<() => void>();
let automationTimer: ReturnType<typeof setInterval> | null = null;
const filteredSnapshotCache = new Map<
  string,
  { source: RecurringCashflow[]; result: RecurringCashflow[] }
>();
let payloadCache: { cacheKey: string; payload: RecurringCashflowsPayload } | null = null;

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function invalidatePayloadCache(): void {
  payloadCache = null;
  filteredSnapshotCache.clear();
}

function readPayload(): RecurringCashflowsPayload {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === RECURRING_CASHFLOWS_ID);
  const cacheKey = record ? `${record.id}:${record.updatedAt}` : "missing";

  if (payloadCache?.cacheKey === cacheKey) {
    return payloadCache.payload;
  }

  const payload = record?.payload as Partial<RecurringCashflowsPayload> | undefined;
  const raw = Array.isArray(payload?.schedules) ? payload.schedules : EMPTY_SCHEDULES;
  const schedules = raw.length === 0 ? EMPTY_SCHEDULES : raw.map(normalizeSchedule);
  const result = { schedules };
  payloadCache = { cacheKey, payload: result };
  filteredSnapshotCache.clear();
  return result;
}

function normalizeSchedule(raw: RecurringCashflow): RecurringCashflow {
  const amount = Math.round((Number(raw.amount) || 0) * 100) / 100;
  const accountId: MemberAccountId = raw.accountId === "escrow" ? "escrow" : "checking";
  const transferToAccountId =
    raw.transferToAccountId === "escrow"
      ? "escrow"
      : raw.transferToAccountId === "checking"
        ? "checking"
        : undefined;

  return {
    ...raw,
    profileId: String(raw.profileId || resolveMemberProfileId()),
    accountId,
    transferToAccountId,
    amount,
    enabled: raw.enabled !== false,
    label: String(raw.label ?? "").trim(),
    startDate: String(raw.startDate ?? formatEasternIsoDate()),
    lastProcessedDate: String(raw.lastProcessedDate ?? ""),
    settledDates: Array.isArray(raw.settledDates)
      ? raw.settledDates.map((ymd) => String(ymd))
      : undefined,
  };
}

function writePayload(payload: RecurringCashflowsPayload): void {
  upsertDataRecord("settings", RECURRING_CASHFLOWS_ID, "recurring-cashflows", {
    schedules: payload.schedules,
  });
  invalidatePayloadCache();
  notifyListeners();
}

function addEasternDays(ymd: string, delta: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const base = easternDateAt(year, month, day, 12);
  base.setUTCDate(base.getUTCDate() + delta);
  return formatEasternIsoDate(base);
}

function addMonthsYmd(ymd: string, months: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  let targetMonth = month - 1 + months;
  let targetYear = year + Math.floor(targetMonth / 12);
  targetMonth = ((targetMonth % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInMonth);
  return formatEasternIsoDate(easternDateAt(targetYear, targetMonth + 1, targetDay, 12));
}

function addYearsYmd(ymd: string, years: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const targetYear = year + years;
  const daysInMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInMonth);
  return formatEasternIsoDate(easternDateAt(targetYear, month, targetDay, 12));
}

function nextOccurrenceAfter(schedule: RecurringCashflow, afterYmd: string | null): string {
  const start = schedule.startDate;
  if (!afterYmd || afterYmd < start) return start;

  switch (schedule.frequency) {
    case "daily":
      return addEasternDays(afterYmd, 1);
    case "weekly":
      return addEasternDays(afterYmd, 7);
    case "biweekly":
      return addEasternDays(afterYmd, 14);
    case "monthly":
      return addMonthsYmd(afterYmd, 1);
    case "yearly":
      return addYearsYmd(afterYmd, 1);
    default:
      return addEasternDays(afterYmd, 1);
  }
}

export function collectDueDates(schedule: RecurringCashflow, today = formatEasternIsoDate()): string[] {
  if (!schedule.enabled || schedule.amount <= 0 || !today) return [];
  if (today < schedule.startDate) return [];

  const dates: string[] = [];
  let cursor: string | null = null;

  while (dates.length < MAX_CATCH_UP) {
    const next = nextOccurrenceAfter(schedule, cursor);
    if (next > today) break;
    cursor = next;
    if (next >= schedule.startDate && !isOccurrenceSettled(schedule, next)) {
      dates.push(next);
    }
  }

  return dates;
}

export function getNextDueDate(
  schedule: RecurringCashflow,
  today = formatEasternIsoDate(),
): string | null {
  const due = collectDueDates(schedule, today);
  if (due.length) return due[0];

  const cursor = schedule.lastProcessedDate || null;
  const next = nextOccurrenceAfter(schedule, cursor);
  return next >= schedule.startDate ? next : schedule.startDate;
}

export interface RecurringDaySummary {
  income: number;
  expense: number;
  transfer: number;
}

const MAX_RANGE_OCCURRENCES = 400;
const MAX_FAST_FORWARD = 5000;

function collectScheduleOccurrencesInRange(
  schedule: RecurringCashflow,
  fromYmd: string,
  toYmd: string,
): string[] {
  if (!schedule.enabled || schedule.amount <= 0) return [];
  if (toYmd < schedule.startDate) return [];

  const dates: string[] = [];
  let cursor: string | null = null;
  let next = nextOccurrenceAfter(schedule, cursor);

  let guard = 0;
  while (next < fromYmd && guard < MAX_FAST_FORWARD) {
    cursor = next;
    next = nextOccurrenceAfter(schedule, cursor);
    guard += 1;
  }

  while (next <= toYmd && dates.length < MAX_RANGE_OCCURRENCES) {
    if (next >= schedule.startDate && next >= fromYmd) {
      dates.push(next);
    }
    cursor = next;
    next = nextOccurrenceAfter(schedule, cursor);
  }

  return dates;
}

export function buildRecurringOccurrenceMap(
  schedules: RecurringCashflow[],
  fromYmd: string,
  toYmd: string,
): Map<string, RecurringDaySummary> {
  const map = new Map<string, RecurringDaySummary>();

  schedules.forEach((schedule) => {
    collectScheduleOccurrencesInRange(schedule, fromYmd, toYmd).forEach((ymd) => {
      const summary = map.get(ymd) ?? { income: 0, expense: 0, transfer: 0 };
      if (schedule.type === "income") summary.income += 1;
      else if (schedule.type === "expense") summary.expense += 1;
      else summary.transfer += 1;
      map.set(ymd, summary);
    });
  });

  return map;
}

export function scheduleOccursOnDate(schedule: RecurringCashflow, dayYmd: string): boolean {
  if (!schedule.enabled || schedule.amount <= 0) return false;
  return collectScheduleOccurrencesInRange(schedule, dayYmd, dayYmd).length > 0;
}

export function getSettledOccurrenceDates(schedule: RecurringCashflow): Set<string> {
  if (schedule.settledDates?.length) {
    return new Set<string>(schedule.settledDates);
  }

  // Legacy schedules only stored lastProcessedDate — treat that single day as settled.
  if (schedule.lastProcessedDate) {
    return new Set<string>([schedule.lastProcessedDate]);
  }

  return new Set<string>();
}

export function isOccurrenceSettled(schedule: RecurringCashflow, dayYmd: string): boolean {
  return hasLedgerEntryForOccurrence(schedule, dayYmd);
}

function occurrenceMemo(schedule: RecurringCashflow): string {
  const label = schedule.label.trim();
  return label ? `${label} · recurring` : "Recurring";
}

function memoMatchesSchedule(schedule: RecurringCashflow, memo: string | undefined): boolean {
  if (!memo) return false;
  const expected = occurrenceMemo(schedule);
  if (memo === expected) return true;
  const label = schedule.label.trim();
  return Boolean(label && memo.includes(label));
}

function hasLedgerEntryForOccurrence(schedule: RecurringCashflow, dayYmd: string): boolean {
  const profileIds = [...new Set([schedule.profileId, resolveMemberProfileId()].filter(Boolean))];

  return profileIds.some((profileId) => {
    const ledger = hydrateMemberAccounts(profileId);
    return ledger.transactions.some((tx) => {
      if (Math.abs(Number(tx.amount) - schedule.amount) > 0.009) return false;
      if (!memoMatchesSchedule(schedule, tx.memo)) return false;
      if (formatEasternIsoDate(tx.createdAt) !== dayYmd) return false;

      if (schedule.type === "income") {
        return tx.type === "deposit" && tx.accountId === schedule.accountId;
      }
      if (schedule.type === "expense") {
        return tx.type === "spend" && tx.accountId === schedule.accountId;
      }
      return (
        tx.type === "transfer" &&
        tx.direction === "debit" &&
        tx.accountId === schedule.accountId
      );
    });
  });
}

function resolveScheduleProfileId(schedule: RecurringCashflow): string {
  return schedule.profileId || resolveMemberProfileId();
}

export interface RecurringDateOccurrence {
  schedule: RecurringCashflow;
  dayYmd: string;
  settled: boolean;
}

export function getRecurringOccurrencesForDate(
  schedules: RecurringCashflow[],
  dayYmd: string,
): RecurringDateOccurrence[] {
  return schedules
    .filter((schedule) => scheduleOccursOnDate(schedule, dayYmd))
    .map((schedule) => ({
      schedule,
      dayYmd,
      settled: isOccurrenceSettled(schedule, dayYmd),
    }))
    .sort((a, b) => {
      const typeOrder = { income: 0, transfer: 1, expense: 2 };
      const typeDiff = typeOrder[a.schedule.type] - typeOrder[b.schedule.type];
      if (typeDiff !== 0) return typeDiff;
      return a.schedule.label.localeCompare(b.schedule.label);
    });
}

function markOccurrenceSettled(
  schedule: RecurringCashflow,
  dayYmd: string,
): Pick<RecurringCashflow, "settledDates" | "lastProcessedDate"> {
  const settledDates = [...new Set([...(schedule.settledDates ?? []), dayYmd])].sort();
  const lastProcessedDate =
    !schedule.lastProcessedDate || dayYmd > schedule.lastProcessedDate
      ? dayYmd
      : schedule.lastProcessedDate;
  return { settledDates, lastProcessedDate };
}

/** Drop settled flags that never posted to the ledger (e.g. after a failed or skipped run). */
function pruneUnverifiedSettledDates(schedule: RecurringCashflow): RecurringCashflow {
  if (!schedule.settledDates?.length) return schedule;

  const verified = schedule.settledDates.filter((ymd) =>
    hasLedgerEntryForOccurrence(schedule, ymd),
  );

  if (verified.length === schedule.settledDates.length) return schedule;
  return { ...schedule, settledDates: verified.length ? verified : undefined };
}

/** Legacy rows may only have lastProcessedDate — do not infer a whole range as paid. */
function migrateLegacySettledDates(schedule: RecurringCashflow): RecurringCashflow {
  if (schedule.settledDates?.length || !schedule.lastProcessedDate) {
    return schedule;
  }

  if (hasLedgerEntryForOccurrence(schedule, schedule.lastProcessedDate)) {
    return { ...schedule, settledDates: [schedule.lastProcessedDate] };
  }

  return schedule;
}

export type PayRecurringResult = "ok" | "not_found" | "already_paid" | "failed";

export function payRecurringOccurrenceNow(
  scheduleId: string,
  dayYmd: string,
): PayRecurringResult {
  const payload = readPayload();
  const index = payload.schedules.findIndex((item) => item.id === scheduleId);
  if (index === -1) return "not_found";

  const schedule = payload.schedules[index];
  if (!scheduleOccursOnDate(schedule, dayYmd)) return "not_found";
  if (isOccurrenceSettled(schedule, dayYmd)) return "already_paid";

  const applied = applyScheduleOccurrence(schedule, dayYmd);
  if (!applied) return "failed";

  payload.schedules[index] = {
    ...schedule,
    ...markOccurrenceSettled(schedule, dayYmd),
  };
  writePayload(payload);
  return "ok";
}

function occurrenceTimestamp(dayYmd: string): string {
  const [year, month, day] = dayYmd.split("-").map(Number);
  const { year: todayY, month: todayM, day: todayD } = getEasternYmd(easternNow());
  const isToday = year === todayY && month === todayM && day === todayD;
  const hour = isToday ? new Date().getUTCHours() : 8;
  return easternDateAt(year, month, day, Math.min(hour, 11), 5).toISOString();
}

function applyScheduleOccurrence(schedule: RecurringCashflow, dayYmd: string): boolean {
  const memo = occurrenceMemo(schedule);
  const occurredAt = occurrenceTimestamp(dayYmd);
  const profileId = resolveScheduleProfileId(schedule);

  if (schedule.type === "income") {
    return (
      depositToMemberAccount(profileId, schedule.accountId, schedule.amount, memo, {
        occurredAt,
      }) !== null
    );
  }

  if (schedule.type === "expense") {
    return (
      spendFromMemberAccount(profileId, schedule.accountId, schedule.amount, memo, {
        occurredAt,
      }) !== null
    );
  }

  if (!schedule.transferToAccountId) return false;

  return (
    transferBetweenMemberAccounts(
      profileId,
      schedule.accountId,
      schedule.transferToAccountId,
      schedule.amount,
      memo,
      { occurredAt },
    ) !== null
  );
}

export function getRecurringCashflows(profileId?: string): RecurringCashflow[] {
  const { schedules } = readPayload();
  if (schedules.length === 0) return EMPTY_SCHEDULES;
  if (!profileId) return schedules;

  const cached = filteredSnapshotCache.get(profileId);
  if (cached?.source === schedules) return cached.result;

  const result = schedules.filter((item) => item.profileId === profileId);
  const snapshot = result.length === 0 ? EMPTY_SCHEDULES : result;
  filteredSnapshotCache.set(profileId, { source: schedules, result: snapshot });
  return snapshot;
}

export function addRecurringCashflow(input: {
  profileId: string;
  accountId: MemberAccountId;
  transferToAccountId?: MemberAccountId;
  type: RecurringCashflowType;
  amount: number;
  frequency: RecurringFrequency;
  label: string;
  startDate?: string;
}): RecurringCashflow | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
  if (
    input.type === "transfer" &&
    (!input.transferToAccountId || input.transferToAccountId === input.accountId)
  ) {
    return null;
  }

  const payload = readPayload();
  const schedule: RecurringCashflow = {
    id: `rcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId: input.profileId,
    accountId: input.accountId,
    transferToAccountId: input.type === "transfer" ? input.transferToAccountId : undefined,
    type: input.type,
    amount: input.amount,
    frequency: input.frequency,
    label: input.label.trim(),
    enabled: true,
    startDate: input.startDate ?? formatEasternIsoDate(),
    lastProcessedDate: "",
    createdAt: easternNow().toISOString(),
  };

  payload.schedules.push(schedule);
  writePayload(payload);
  processRecurringCashflows();
  return schedule;
}

export function updateRecurringCashflow(
  id: string,
  updates: Partial<
    Pick<
      RecurringCashflow,
      | "accountId"
      | "transferToAccountId"
      | "type"
      | "amount"
      | "frequency"
      | "label"
      | "enabled"
      | "startDate"
    >
  >,
): RecurringCashflow | null {
  const payload = readPayload();
  const index = payload.schedules.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const current = payload.schedules[index];
  const nextAmount = updates.amount ?? current.amount;
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) return null;

  const updated: RecurringCashflow = {
    ...current,
    ...updates,
    amount: nextAmount,
    label: updates.label !== undefined ? updates.label.trim() : current.label,
  };

  payload.schedules[index] = updated;
  writePayload(payload);
  if (updated.enabled) processRecurringCashflows();
  return updated;
}

export function deleteRecurringCashflow(id: string): boolean {
  const payload = readPayload();
  const next = payload.schedules.filter((item) => item.id !== id);
  if (next.length === payload.schedules.length) return false;
  writePayload({ schedules: next });
  return true;
}

export function processRecurringCashflows(): number {
  rolloverEasternDayIfNeeded();
  invalidateMemberAccountsCache();

  const today = formatEasternIsoDate();
  const payload = readPayload();
  let processedCount = 0;
  let changed = false;

  const nextSchedules = payload.schedules.map((schedule) => {
    if (!schedule.enabled || schedule.amount <= 0) return schedule;

    let working = migrateLegacySettledDates(schedule);
    working = pruneUnverifiedSettledDates(working);
    if (working !== schedule) {
      changed = true;
    }

    const dueDates = collectDueDates(working, today);
    if (!dueDates.length) {
      return working;
    }

    let updatedSchedule = working;

    for (const dayYmd of dueDates) {
      if (isOccurrenceSettled(updatedSchedule, dayYmd)) continue;
      const applied = applyScheduleOccurrence(updatedSchedule, dayYmd);
      if (!applied) break;
      updatedSchedule = { ...updatedSchedule, ...markOccurrenceSettled(updatedSchedule, dayYmd) };
      processedCount += 1;
    }

    if (
      updatedSchedule.lastProcessedDate === working.lastProcessedDate &&
      (updatedSchedule.settledDates ?? []).join(",") === (working.settledDates ?? []).join(",")
    ) {
      return working;
    }

    changed = true;
    return updatedSchedule;
  });

  if (changed) {
    writePayload({ schedules: nextSchedules });
  }

  return processedCount;
}

function msUntilNextEasternMidnight(): number {
  const today = formatEasternIsoDate();
  const nextDay = addEasternDays(today, 1);
  const [year, month, day] = nextDay.split("-").map(Number);
  const nextMidnight = easternDateAt(year, month, day, 0, 1);
  return Math.max(1_000, nextMidnight.getTime() - easternNow().getTime());
}

let trackedEasternDay = formatEasternIsoDate();
let midnightTimer: ReturnType<typeof setTimeout> | null = null;

function runRecurringCashflowTick(): number {
  const today = formatEasternIsoDate();
  if (today !== trackedEasternDay) {
    trackedEasternDay = today;
  }
  return processRecurringCashflows();
}

function scheduleNextEasternMidnightTick(run: () => void): void {
  if (midnightTimer) {
    clearTimeout(midnightTimer);
  }
  midnightTimer = setTimeout(() => {
    run();
    scheduleNextEasternMidnightTick(run);
  }, msUntilNextEasternMidnight());
}

export function subscribeRecurringCashflows(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeDb = subscribeInternalDatabase(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeDb();
  };
}

export function useRecurringCashflows(profileId?: string): RecurringCashflow[] {
  return useSyncExternalStore(
    subscribeRecurringCashflows,
    () => getRecurringCashflows(profileId),
    () => getRecurringCashflows(profileId),
  );
}

export function startRecurringCashflowAutomation(): () => void {
  trackedEasternDay = formatEasternIsoDate();
  runRecurringCashflowTick();

  if (automationTimer) {
    clearInterval(automationTimer);
  }

  automationTimer = setInterval(() => {
    runRecurringCashflowTick();
  }, CHECK_INTERVAL_MS);

  scheduleNextEasternMidnightTick(() => {
    runRecurringCashflowTick();
  });

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      runRecurringCashflowTick();
    }
  };

  document.addEventListener("visibilitychange", onVisible);

  return () => {
    if (automationTimer) {
      clearInterval(automationTimer);
      automationTimer = null;
    }
    if (midnightTimer) {
      clearTimeout(midnightTimer);
      midnightTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisible);
  };
}
