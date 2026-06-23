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
  spendFromMemberAccount,
  transferBetweenMemberAccounts,
  type MemberAccountId,
} from "./memberAccounts";

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
  createdAt: string;
}

interface RecurringCashflowsPayload {
  schedules: RecurringCashflow[];
}

export const RECURRING_CASHFLOWS_ID = "recurring-cashflows";
const CHECK_INTERVAL_MS = 60_000;
const MAX_CATCH_UP = 30;

const listeners = new Set<() => void>();
let automationTimer: ReturnType<typeof setInterval> | null = null;
const filteredSnapshotCache = new Map<
  string,
  { source: RecurringCashflow[]; result: RecurringCashflow[] }
>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function readPayload(): RecurringCashflowsPayload {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === RECURRING_CASHFLOWS_ID);
  const payload = record?.payload as Partial<RecurringCashflowsPayload> | undefined;
  const schedules = Array.isArray(payload?.schedules) ? payload.schedules : [];
  return { schedules };
}

function writePayload(payload: RecurringCashflowsPayload): void {
  upsertDataRecord("settings", RECURRING_CASHFLOWS_ID, "recurring-cashflows", {
    schedules: payload.schedules,
  });
  filteredSnapshotCache.clear();
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

  const dates: string[] = [];
  let cursor = schedule.lastProcessedDate || null;

  while (dates.length < MAX_CATCH_UP) {
    const next = nextOccurrenceAfter(schedule, cursor);
    if (next > today) break;
    dates.push(next);
    cursor = next;
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

function occurrenceTimestamp(dayYmd: string): string {
  const [year, month, day] = dayYmd.split("-").map(Number);
  const { year: todayY, month: todayM, day: todayD } = getEasternYmd(easternNow());
  const isToday = year === todayY && month === todayM && day === todayD;
  const hour = isToday ? new Date().getUTCHours() : 8;
  return easternDateAt(year, month, day, Math.min(hour, 11), 5).toISOString();
}

function applyScheduleOccurrence(schedule: RecurringCashflow, dayYmd: string): boolean {
  const memo = schedule.label.trim() || undefined;
  const occurredAt = occurrenceTimestamp(dayYmd);

  if (schedule.type === "income") {
    return (
      depositToMemberAccount(schedule.profileId, schedule.accountId, schedule.amount, memo, {
        occurredAt,
      }) !== null
    );
  }

  if (schedule.type === "expense") {
    return (
      spendFromMemberAccount(schedule.profileId, schedule.accountId, schedule.amount, memo, {
        occurredAt,
      }) !== null
    );
  }

  if (!schedule.transferToAccountId) return false;

  return (
    transferBetweenMemberAccounts(
      schedule.profileId,
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
  if (!profileId) return schedules;

  const cached = filteredSnapshotCache.get(profileId);
  if (cached?.source === schedules) return cached.result;

  const result = schedules.filter((item) => item.profileId === profileId);
  filteredSnapshotCache.set(profileId, { source: schedules, result });
  return result;
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
  const today = formatEasternIsoDate();
  const payload = readPayload();
  let processedCount = 0;
  let changed = false;

  const nextSchedules = payload.schedules.map((schedule) => {
    if (!schedule.enabled || schedule.amount <= 0) return schedule;

    const dueDates = collectDueDates(schedule, today);
    if (!dueDates.length) return schedule;

    let lastProcessed = schedule.lastProcessedDate;

    for (const dayYmd of dueDates) {
      const applied = applyScheduleOccurrence(schedule, dayYmd);
      if (!applied) break;
      lastProcessed = dayYmd;
      processedCount += 1;
    }

    if (lastProcessed === schedule.lastProcessedDate) return schedule;

    changed = true;
    return { ...schedule, lastProcessedDate: lastProcessed };
  });

  if (changed) {
    writePayload({ schedules: nextSchedules });
  }

  return processedCount;
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
  processRecurringCashflows();

  if (automationTimer) {
    clearInterval(automationTimer);
  }

  automationTimer = setInterval(() => {
    processRecurringCashflows();
  }, CHECK_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      processRecurringCashflows();
    }
  };

  document.addEventListener("visibilitychange", onVisible);

  return () => {
    if (automationTimer) {
      clearInterval(automationTimer);
      automationTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisible);
  };
}
