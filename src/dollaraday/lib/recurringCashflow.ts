import { useSyncExternalStore } from "react";
import {
  easternDateAt,
  easternNow,
  formatEasternIsoDate,
  getEasternYmd,
} from "./dateTime";
import { readDataBin, subscribeInternalDatabase, upsertDataRecord } from "./internalDatabase";
import {
  depositDonationToPlatformEscrow,
  depositToMemberAccount,
  hydrateMemberAccounts,
  invalidateMemberAccountsCache,
  resolveMemberProfileId,
  resolvePlatformEscrowProfileId,
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
/** Label used by contribute-today / donation onboarding schedules. */
export const HOME_CONTRIBUTION_LABEL = "Home contribution";
/** Stable schedule id prefix for each contribute-onboarding donation record. */
export const DONATION_SCHEDULE_ID_PREFIX = "rcf-donate-";
/** Backup interval; midnight + visibilitychange cover the primary path. */
const CHECK_INTERVAL_MS = 5 * 60_000;
const MAX_CATCH_UP = 30;
const EMPTY_SCHEDULES: RecurringCashflow[] = [];

export function isHomeContributionSchedule(
  schedule: Pick<RecurringCashflow, "label" | "id"> | { label?: string; id?: string },
): boolean {
  const id = String(schedule.id ?? "");
  if (id.startsWith(DONATION_SCHEDULE_ID_PREFIX) || id.startsWith("rcf-home-")) return true;
  return String(schedule.label ?? "").trim() === HOME_CONTRIBUTION_LABEL;
}

export function donationScheduleIdForContribution(recordId: string): string {
  return `${DONATION_SCHEDULE_ID_PREFIX}${recordId}`;
}

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
    // Keep stored owner as-is — never rewrite to the viewer (that leaked other members' dates).
    profileId: String(raw.profileId ?? "").trim(),
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
  /** Sum of income/donation amounts due on this day. */
  incomeAmount: number;
  expenseAmount: number;
  transferAmount: number;
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
    const amount = Number(schedule.amount) || 0;
    collectScheduleOccurrencesInRange(schedule, fromYmd, toYmd).forEach((ymd) => {
      const summary = map.get(ymd) ?? {
        income: 0,
        expense: 0,
        transfer: 0,
        incomeAmount: 0,
        expenseAmount: 0,
        transferAmount: 0,
      };
      if (schedule.type === "income") {
        summary.income += 1;
        summary.incomeAmount += amount;
      } else if (schedule.type === "expense") {
        summary.expense += 1;
        summary.expenseAmount += amount;
      } else {
        summary.transfer += 1;
        summary.transferAmount += amount;
      }
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
  const profileIds = new Set<string>(
    [schedule.profileId, resolveMemberProfileId()].filter(Boolean),
  );
  // Home donations settle on master admin Chase Escrow.
  if (isHomeContributionSchedule(schedule)) {
    profileIds.add(resolvePlatformEscrowProfileId(schedule.profileId));
  }

  return [...profileIds].some((profileId) => {
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

function mirrorHomeContributionOccurrence(
  profileId: string,
  schedule: RecurringCashflow,
  occurredAt: string,
): void {
  void Promise.all([
    import("./internalDatabase"),
    import("./memberRegistry"),
    import("./poolState"),
    import("./dadProfileStorage"),
  ]).then(
    ([
      { appendDataRecord },
      { updateMemberAfterContribution, findStoredMemberByProfileId },
      { registerContribution },
      { findDadProfileById },
    ]) => {
      const profile = findDadProfileById(profileId);
      const member = findStoredMemberByProfileId(profileId);
      const memberName = member?.name || profile?.displayName || "Member";
      const handle = member?.handle || (profile ? `@${profile.username}` : "");

      appendDataRecord("contributions", "recurring-home-contribution", {
        type: "recurring",
        amount: schedule.amount,
        recurringEnabled: true,
        frequency: schedule.frequency,
        profileId,
        memberId: profileId,
        memberName,
        handle,
        contributedAt: occurredAt,
        status: "completed",
      });
      updateMemberAfterContribution(profileId, schedule.amount);
      registerContribution({
        amount: schedule.amount,
        recurringEnabled: true,
        memberId: profileId,
        memberName,
        handle,
      });
    },
  );
}

function applyScheduleOccurrence(schedule: RecurringCashflow, dayYmd: string): boolean {
  const memo = occurrenceMemo(schedule);
  const occurredAt = occurrenceTimestamp(dayYmd);
  const profileId = resolveScheduleProfileId(schedule);

  if (schedule.type === "income") {
    const deposited = isHomeContributionSchedule(schedule)
      ? depositDonationToPlatformEscrow(schedule.amount, memo, {
          occurredAt,
          donorProfileId: profileId,
        }) !== null
      : depositToMemberAccount(profileId, schedule.accountId, schedule.amount, memo, {
          occurredAt,
        }) !== null;
    if (deposited && isHomeContributionSchedule(schedule)) {
      mirrorHomeContributionOccurrence(profileId, schedule, occurredAt);
    }
    return deposited;
  }

  if (schedule.type === "expense") {
    return (
      spendFromMemberAccount(profileId, schedule.accountId, schedule.amount, memo, {
        occurredAt,
      }) !== null
    );
  }

  // Legacy home-contribution transfers → settle on master admin Chase Escrow.
  if (isHomeContributionSchedule(schedule)) {
    const deposited =
      depositDonationToPlatformEscrow(schedule.amount, memo, {
        occurredAt,
        donorProfileId: profileId,
      }) !== null;
    if (deposited) {
      mirrorHomeContributionOccurrence(profileId, schedule, occurredAt);
    }
    return deposited;
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

function normalizeContributionFrequency(raw: unknown): RecurringFrequency {
  if (
    raw === "daily" ||
    raw === "weekly" ||
    raw === "biweekly" ||
    raw === "monthly" ||
    raw === "yearly"
  ) {
    return raw;
  }
  return "monthly";
}

function nextStartForFrequency(frequency: RecurringFrequency, fromYmd: string): string {
  switch (frequency) {
    case "daily":
      return addEasternDays(fromYmd, 1);
    case "weekly":
      return addEasternDays(fromYmd, 7);
    case "biweekly":
      return addEasternDays(fromYmd, 14);
    case "yearly":
      return addYearsYmd(fromYmd, 1);
    case "monthly":
    default:
      return addMonthsYmd(fromYmd, 1);
  }
}

/** User-started recurring donations only — not automated occurrence mirrors. */
function isRecurringDonationSeedRecord(record: {
  source: string;
  payload?: Record<string, unknown>;
}): boolean {
  const entry = record.payload ?? {};
  if (!entry.recurringEnabled) return false;
  if (entry.automated) return false;
  if (record.source === "recurring-home-contribution" || record.source === "recurring-automation") {
    return false;
  }
  if (record.source === "wallet-deposit") return false;
  if (record.source === "contribute-onboarding") return true;
  return String(entry.type ?? "") === "recurring";
}

/**
 * Keep donation (contribute-today) schedules aligned with contribution records:
 * one enabled recurring donation → one income schedule (so same-day multiples all show).
 */
export function ensureHomeContributionSchedulesFromContributions(profileId?: string): boolean {
  const contributions = readDataBin("contributions");
  const desired = new Map<
    string,
    {
      profileId: string;
      amount: number;
      frequency: RecurringFrequency;
      contributedAt: string;
    }
  >();

  for (const record of contributions.records) {
    if (!isRecurringDonationSeedRecord(record)) continue;

    const entry = record.payload as Record<string, unknown> | undefined;
    if (!entry?.profileId) continue;
    const pid = String(entry.profileId);
    if (profileId && pid !== profileId) continue;

    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    desired.set(donationScheduleIdForContribution(record.id), {
      profileId: pid,
      amount,
      frequency: normalizeContributionFrequency(entry.frequency),
      contributedAt: String(entry.contributedAt ?? record.updatedAt ?? ""),
    });
  }

  const payload = readPayload();
  let changed = false;
  const profilesWithDonateSchedules = new Set<string>();

  payload.schedules = payload.schedules.map((schedule) => {
    if (!isHomeContributionSchedule(schedule)) return schedule;
    if (profileId && schedule.profileId !== profileId) return schedule;
    if (
      schedule.type === "income" &&
      schedule.accountId === "escrow" &&
      schedule.transferToAccountId === undefined
    ) {
      return schedule;
    }
    changed = true;
    return {
      ...schedule,
      type: "income" as const,
      accountId: "escrow" as const,
      transferToAccountId: undefined,
    };
  });

  for (const [scheduleId, info] of desired) {
    profilesWithDonateSchedules.add(info.profileId);
    const index = payload.schedules.findIndex((schedule) => schedule.id === scheduleId);
    const contributedYmd = info.contributedAt
      ? formatEasternIsoDate(info.contributedAt)
      : formatEasternIsoDate();

    if (index >= 0) {
      const existing = payload.schedules[index];
      if (
        existing.amount !== info.amount ||
        existing.frequency !== info.frequency ||
        !existing.enabled ||
        existing.type !== "income" ||
        existing.accountId !== "escrow" ||
        existing.label !== HOME_CONTRIBUTION_LABEL
      ) {
        payload.schedules[index] = {
          ...existing,
          amount: info.amount,
          frequency: info.frequency,
          enabled: true,
          type: "income",
          accountId: "escrow",
          transferToAccountId: undefined,
          label: HOME_CONTRIBUTION_LABEL,
        };
        changed = true;
      }
      continue;
    }

    payload.schedules.push({
      id: scheduleId,
      profileId: info.profileId,
      accountId: "escrow",
      type: "income",
      amount: info.amount,
      frequency: info.frequency,
      label: HOME_CONTRIBUTION_LABEL,
      enabled: true,
      startDate: nextStartForFrequency(info.frequency, contributedYmd),
      lastProcessedDate: contributedYmd,
      settledDates: [contributedYmd],
      createdAt: info.contributedAt || easternNow().toISOString(),
    });
    changed = true;
  }

  // Drop per-donation schedules whose contribution was removed / turned off.
  const before = payload.schedules.length;
  payload.schedules = payload.schedules.filter((schedule) => {
    if (!schedule.id.startsWith(DONATION_SCHEDULE_ID_PREFIX)) return true;
    if (profileId && schedule.profileId !== profileId) return true;
    return desired.has(schedule.id);
  });
  if (payload.schedules.length !== before) changed = true;

  // Legacy single-slot home schedules duplicate once per-donation rows exist.
  const afterLegacy = payload.schedules.filter((schedule) => {
    if (!schedule.id.startsWith("rcf-home-")) return true;
    if (profileId && schedule.profileId !== profileId) return true;
    return !profilesWithDonateSchedules.has(schedule.profileId);
  });
  if (afterLegacy.length !== payload.schedules.length) {
    payload.schedules = afterLegacy;
    changed = true;
  }

  if (changed) writePayload(payload);
  return changed;
}

export function getRecurringCashflows(profileId?: string): RecurringCashflow[] {
  const { schedules } = readPayload();
  if (schedules.length === 0) return EMPTY_SCHEDULES;
  if (!profileId) return schedules;

  const cached = filteredSnapshotCache.get(profileId);
  if (cached?.source === schedules) return cached.result;

  const ownerId = String(profileId).trim();
  const result = schedules.filter((item) => String(item.profileId ?? "").trim() === ownerId);
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
  id?: string;
  lastProcessedDate?: string;
  settledDates?: string[];
}): RecurringCashflow | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return null;
  if (
    input.type === "transfer" &&
    (!input.transferToAccountId || input.transferToAccountId === input.accountId)
  ) {
    return null;
  }

  const payload = readPayload();
  if (input.id && payload.schedules.some((schedule) => schedule.id === input.id)) {
    return updateRecurringCashflow(input.id, {
      accountId: input.accountId,
      transferToAccountId: input.transferToAccountId,
      type: input.type,
      amount: input.amount,
      frequency: input.frequency,
      label: input.label,
      enabled: true,
      startDate: input.startDate,
    });
  }

  const schedule: RecurringCashflow = {
    id: input.id ?? `rcf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId: input.profileId,
    accountId: input.accountId,
    transferToAccountId: input.type === "transfer" ? input.transferToAccountId : undefined,
    type: input.type,
    amount: input.amount,
    frequency: input.frequency,
    label: input.label.trim(),
    enabled: true,
    startDate: input.startDate ?? formatEasternIsoDate(),
    lastProcessedDate: input.lastProcessedDate ?? "",
    settledDates: input.settledDates,
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

  const nextType = updates.type ?? current.type;
  const updated: RecurringCashflow = {
    ...current,
    ...updates,
    amount: nextAmount,
    type: nextType,
    label: updates.label !== undefined ? updates.label.trim() : current.label,
    transferToAccountId:
      nextType === "transfer"
        ? (updates.transferToAccountId ?? current.transferToAccountId)
        : undefined,
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
  ensureHomeContributionSchedulesFromContributions();

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
    if (document.visibilityState !== "visible") return;
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
