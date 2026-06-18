import {
  easternDateAt,
  easternNow,
  formatEasternIsoDate,
  formatEasternLongDate,
  getEasternYmd,
  getMissedEasternDays,
} from "./dateTime";
import { appendDataRecord, readDataBin, upsertDataRecord } from "./internalDatabase";
import { findStoredMemberByProfileId, updateMemberAfterContribution } from "./memberRegistry";
import { registerContribution, rolloverEasternDayIfNeeded } from "./poolState";

export const RECURRING_SCHEDULES_ID = "recurring-schedules";

export interface RecurringSubscription {
  profileId: string;
  memberId: string;
  memberName: string;
  handle: string;
  amount: number;
  enabled: boolean;
  reminderEnabled: boolean;
  lastProcessedDate: string;
  createdAt: string;
}

interface RecurringSchedulesPayload {
  subscriptions: RecurringSubscription[];
}

const CHECK_INTERVAL_MS = 60_000;

function readSchedulesPayload(): RecurringSchedulesPayload {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === RECURRING_SCHEDULES_ID);
  const payload = record?.payload as Partial<RecurringSchedulesPayload> | undefined;
  const subscriptions = Array.isArray(payload?.subscriptions) ? payload.subscriptions : [];
  return { subscriptions };
}

function writeSchedulesPayload(payload: RecurringSchedulesPayload): void {
  upsertDataRecord(
    "settings",
    RECURRING_SCHEDULES_ID,
    "recurring-schedules",
    payload as unknown as Record<string, unknown>,
  );
}

function hydrateRecurringFromContributions(): void {
  const contributions = readDataBin("contributions");
  const latestByProfile = new Map<string, Record<string, unknown>>();

  contributions.records.forEach((record) => {
    const entry = record.payload as Record<string, unknown> | undefined;
    if (!entry?.profileId || !entry.recurringEnabled) return;

    const profileId = String(entry.profileId);
    const contributedAt = String(entry.contributedAt ?? record.updatedAt ?? "");
    const existing = latestByProfile.get(profileId);
    if (!existing || contributedAt > String(existing.contributedAt ?? "")) {
      latestByProfile.set(profileId, entry);
    }
  });

  const payload = readSchedulesPayload();
  let changed = false;

  latestByProfile.forEach((entry, profileId) => {
    if (payload.subscriptions.some((item) => item.profileId === profileId)) return;

    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    payload.subscriptions.push({
      profileId,
      memberId: String(entry.memberId ?? profileId),
      memberName: String(entry.memberName ?? "Member"),
      handle: String(entry.handle ?? "@member"),
      amount,
      enabled: true,
      reminderEnabled: Boolean(entry.reminderEnabled ?? true),
      lastProcessedDate: formatEasternIsoDate(String(entry.contributedAt ?? easternNow())),
      createdAt: String(entry.contributedAt ?? easternNow().toISOString()),
    });
    changed = true;
  });

  if (changed) {
    writeSchedulesPayload(payload);
  }
}

export function getRecurringSubscriptions(): RecurringSubscription[] {
  return readSchedulesPayload().subscriptions;
}

export function upsertRecurringSubscription(input: {
  profileId: string;
  memberId: string;
  memberName: string;
  handle: string;
  amount: number;
  enabled: boolean;
  reminderEnabled?: boolean;
  markProcessedToday?: boolean;
}): RecurringSubscription {
  const today = formatEasternIsoDate();
  const payload = readSchedulesPayload();
  const index = payload.subscriptions.findIndex((item) => item.profileId === input.profileId);
  const existing = index >= 0 ? payload.subscriptions[index] : null;

  const subscription: RecurringSubscription = {
    profileId: input.profileId,
    memberId: input.memberId,
    memberName: input.memberName,
    handle: input.handle,
    amount: input.amount,
    enabled: input.enabled,
    reminderEnabled: input.reminderEnabled ?? existing?.reminderEnabled ?? true,
    lastProcessedDate:
      input.markProcessedToday || !input.enabled
        ? today
        : existing?.lastProcessedDate ?? "",
    createdAt: existing?.createdAt ?? easternNow().toISOString(),
  };

  if (index >= 0) {
    payload.subscriptions[index] = subscription;
  } else {
    payload.subscriptions.push(subscription);
  }

  writeSchedulesPayload(payload);
  return subscription;
}

export function disableRecurringSubscription(profileId: string): void {
  const payload = readSchedulesPayload();
  const index = payload.subscriptions.findIndex((item) => item.profileId === profileId);
  if (index === -1) return;

  payload.subscriptions[index] = {
    ...payload.subscriptions[index],
    enabled: false,
  };
  writeSchedulesPayload(payload);
}

function contributionTimestampForDay(dayYmd: string): Date {
  const [year, month, day] = dayYmd.split("-").map(Number);
  const { year: todayY, month: todayM, day: todayD } = getEasternYmd(easternNow());
  const isToday = year === todayY && month === todayM && day === todayD;
  const hour = isToday ? new Date().getUTCHours() : 8;
  return easternDateAt(year, month, day, Math.min(hour, 11), 4);
}

function applyRecurringForDay(
  subscription: RecurringSubscription,
  dayYmd: string,
  includeDailyActivity: boolean,
): void {
  if (!subscription.enabled || subscription.amount <= 0) return;

  const contributedAt = contributionTimestampForDay(dayYmd).toISOString();

  appendDataRecord("contributions", "recurring-automation", {
    type: "recurring",
    amount: subscription.amount,
    recurringEnabled: true,
    profileId: subscription.profileId,
    memberId: subscription.memberId,
    memberName: subscription.memberName,
    handle: subscription.handle,
    contributedAt,
    recurringDay: dayYmd,
    status: "completed",
    automated: true,
  });

  registerContribution({
    amount: subscription.amount,
    memberId: subscription.memberId,
    memberName: subscription.memberName,
    handle: subscription.handle,
    includeDailyActivity,
    contributedAt: contributionTimestampForDay(dayYmd),
  });

  updateMemberAfterContribution(subscription.profileId, subscription.amount);

  const member = findStoredMemberByProfileId(subscription.profileId);
  if (member) {
    upsertDataRecord("members", `member-${subscription.profileId}`, "recurring-sync", {
      profileId: subscription.profileId,
      username: member.username,
      name: member.name,
      handle: member.handle,
      tier: member.tier,
      contributed: member.contributed,
      equity: member.equity,
      days: member.days,
      score: member.score,
      streak: member.streak,
      status: member.status,
      joinedAt: member.joinedAt,
      recurringAmount: subscription.amount,
      recurringEnabled: true,
    });
  }
}

export function processRecurringContributions(): number {
  rolloverEasternDayIfNeeded();

  const today = formatEasternIsoDate();
  const payload = readSchedulesPayload();
  let processedCount = 0;

  payload.subscriptions = payload.subscriptions.map((subscription) => {
    if (!subscription.enabled || subscription.amount <= 0) {
      return subscription;
    }

    const missedDays = getMissedEasternDays(subscription.lastProcessedDate, today);
    if (!missedDays.length) return subscription;

    missedDays.forEach((dayYmd, index) => {
      const isToday = dayYmd === today;
      const includeDailyActivity = isToday && index === missedDays.length - 1;
      applyRecurringForDay(subscription, dayYmd, includeDailyActivity);
      processedCount += 1;
    });

    return {
      ...subscription,
      lastProcessedDate: today,
    };
  });

  writeSchedulesPayload(payload);
  return processedCount;
}

let automationTimer: ReturnType<typeof setInterval> | null = null;

export function startRecurringAutomation(): () => void {
  hydrateRecurringFromContributions();
  processRecurringContributions();

  if (automationTimer) {
    clearInterval(automationTimer);
  }

  automationTimer = setInterval(() => {
    processRecurringContributions();
  }, CHECK_INTERVAL_MS);

  const onVisible = () => {
    if (document.visibilityState === "visible") {
      processRecurringContributions();
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

export function formatRecurringDayLabel(dayYmd: string): string {
  const [year, month, day] = dayYmd.split("-").map(Number);
  return formatEasternLongDate(easternDateAt(year, month, day, 12));
}
