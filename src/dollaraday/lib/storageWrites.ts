import { getActiveDadProfile } from "./dadProfileStorage";
import { addEasternDays, easternDateAt, formatEasternIsoDate } from "./dateTime";
import { appendDataRecord } from "./internalDatabase";
import { logProfileActivity } from "./profileActivity";
import {
  depositToMemberAccount,
  resolveMemberProfileId,
  transferBetweenMemberAccounts,
} from "./memberAccounts";
import { updateMemberAfterContribution } from "./memberRegistry";
import {
  addRecurringCashflow,
  deleteRecurringCashflow,
  getRecurringCashflows,
  updateRecurringCashflow,
} from "./recurringCashflow";
import { disableRecurringSubscription } from "./recurringContributions";
import { getPoolState, registerContribution, syncMemberEscrowToLiquidityPool } from "./poolState";

export type HomeContributionFrequency = "weekly" | "monthly" | "yearly";

const HOME_CONTRIBUTION_LABEL = "Home contribution";

function addEasternMonths(ymd: string, months: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  let targetMonth = month - 1 + months;
  let targetYear = year + Math.floor(targetMonth / 12);
  targetMonth = ((targetMonth % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInMonth);
  return formatEasternIsoDate(
    easternDateAt(targetYear, targetMonth + 1, targetDay, 12),
  );
}

function addEasternYears(ymd: string, years: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const targetYear = year + years;
  const daysInMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInMonth);
  return formatEasternIsoDate(easternDateAt(targetYear, month, targetDay, 12));
}

function nextRecurringStart(frequency: HomeContributionFrequency): string {
  const today = formatEasternIsoDate();
  switch (frequency) {
    case "monthly":
      return addEasternMonths(today, 1);
    case "yearly":
      return addEasternYears(today, 1);
    default:
      return addEasternDays(today, 7);
  }
}

function contributionMemo(
  frequency: HomeContributionFrequency,
  recurringEnabled: boolean,
): string {
  if (!recurringEnabled) return "One-time contribution";
  if (frequency === "monthly") return "Monthly contribution";
  if (frequency === "yearly") return "Yearly contribution";
  return "Weekly contribution";
}

export function saveCommunityPost({
  title,
  body,
  channelId,
  channelLabel,
}: {
  title: string;
  body: string;
  channelId: string;
  channelLabel: string;
}) {
  const { currentMember } = getPoolState();
  const profile = getActiveDadProfile();

  const record = appendDataRecord("communityPosts", "community-post-onboarding", {
    title,
    body,
    channelId,
    channelLabel,
    author: currentMember.name,
    handle: currentMember.handle,
    profileId: profile?.id,
    publishedAt: new Date().toISOString(),
  });

  if (profile) {
    logProfileActivity({
      profileId: profile.id,
      proId: profile.proId,
      type: "post",
      summary: `Posted "${title}" in ${channelLabel}`,
      payload: { channelId, channelLabel },
    });
  }

  return record;
}

function findHomeContributionSchedule(profileId: string) {
  return getRecurringCashflows(profileId).find(
    (schedule) =>
      schedule.label === HOME_CONTRIBUTION_LABEL &&
      schedule.type === "transfer" &&
      schedule.accountId === "checking" &&
      schedule.transferToAccountId === "escrow",
  );
}

function depositContributionToEscrow(profileId: string, amount: number, memo: string): boolean {
  if (
    transferBetweenMemberAccounts(profileId, "checking", "escrow", amount, memo) !== null
  ) {
    return true;
  }

  return depositToMemberAccount(profileId, "escrow", amount, memo) !== null;
}

function syncHomeContributionSchedule(
  profileId: string,
  amount: number,
  enabled: boolean,
  frequency: HomeContributionFrequency,
): void {
  const existing = findHomeContributionSchedule(profileId);

  if (!enabled) {
    if (existing) deleteRecurringCashflow(existing.id);
    disableRecurringSubscription(profileId);
    return;
  }

  const nextStart = nextRecurringStart(frequency);

  if (existing) {
    updateRecurringCashflow(existing.id, {
      amount,
      enabled: true,
      frequency,
      startDate: nextStart,
      accountId: "checking",
      transferToAccountId: "escrow",
      type: "transfer",
      label: HOME_CONTRIBUTION_LABEL,
    });
  } else {
    addRecurringCashflow({
      profileId,
      accountId: "checking",
      transferToAccountId: "escrow",
      type: "transfer",
      amount,
      frequency,
      label: HOME_CONTRIBUTION_LABEL,
      startDate: nextStart,
    });
  }

  disableRecurringSubscription(profileId);
}

export function saveContribution({
  amount,
  reminderEnabled,
  recurringEnabled,
  frequency = "weekly",
}: {
  amount: number;
  reminderEnabled: boolean;
  recurringEnabled: boolean;
  frequency?: HomeContributionFrequency;
}) {
  const { currentMember } = getPoolState();
  const profile = getActiveDadProfile();
  const profileId = profile?.id ?? resolveMemberProfileId();

  appendDataRecord("contributions", "contribute-onboarding", {
    type: recurringEnabled ? "recurring" : "one-time",
    amount,
    reminderEnabled,
    recurringEnabled,
    frequency: recurringEnabled ? frequency : undefined,
    profileId,
    memberId: currentMember.id,
    memberName: currentMember.name,
    handle: currentMember.handle,
    contributedAt: new Date().toISOString(),
    status: "completed",
  });

  const memo = contributionMemo(frequency, recurringEnabled);
  const deposited = depositContributionToEscrow(profileId, amount, memo);

  if (profile) {
    logProfileActivity({
      profileId: profile.id,
      proId: profile.proId,
      type: "donation",
      summary: `${recurringEnabled ? "Recurring" : "One-time"} donation of $${amount.toFixed(2)}`,
      payload: { amount, recurringEnabled, frequency: recurringEnabled ? frequency : undefined },
    });
  }

  if (profile?.id) {
    updateMemberAfterContribution(profile.id, amount);
    syncHomeContributionSchedule(profile.id, amount, recurringEnabled, frequency);
  } else {
    syncHomeContributionSchedule(profileId, amount, recurringEnabled, frequency);
  }

  registerContribution({
    amount,
    reminderEnabled,
    recurringEnabled,
    memberId: currentMember.id,
    memberName: currentMember.name,
    handle: currentMember.handle,
  });

  // Escrow deposit already syncs capital; force another pass if deposit used a fallback path.
  if (deposited) {
    syncMemberEscrowToLiquidityPool();
  }

  // Push contribution-related bins immediately so the shared pool updates worldwide.
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(async ({ pushCloudBinsNow }) => {
      const { readDataBin } = await import("./internalDatabase");
      const { DATA_BIN_BY_KEY } = await import("./dataBins");
      await pushCloudBinsNow([
        { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
        { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
        { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
      ]);
    });
  });
}

export function saveAdminCapture(source: string, payload: Record<string, unknown>) {
  return appendDataRecord("adminCaptures", source, payload);
}
