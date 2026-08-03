import { getActiveDadProfile } from "./dadProfileStorage";
import { addEasternDays, easternDateAt, formatEasternIsoDate } from "./dateTime";
import { appendDataRecord } from "./internalDatabase";
import { logProfileActivity } from "./profileActivity";
import {
  depositDonationToPlatformEscrow,
  depositToMemberWallet,
  resolveMemberProfileId,
} from "./memberAccounts";
import { updateMemberAfterContribution } from "./memberRegistry";
import {
  addRecurringCashflow,
  donationScheduleIdForContribution,
  ensureHomeContributionSchedulesFromContributions,
  HOME_CONTRIBUTION_LABEL,
} from "./recurringCashflow";
import { disableRecurringSubscription } from "./recurringContributions";
import { playCashSound } from "./playCashSound";
import { getPoolState, registerContribution, syncMemberEscrowToLiquidityPool } from "./poolState";

function pushContributionBinsNow() {
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

export type HomeContributionFrequency = "weekly" | "monthly" | "yearly";

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

function depositContributionToEscrow(
  donorProfileId: string,
  amount: number,
  memo: string,
): boolean {
  // All member donations settle into master admin Chase Escrow (liquidity pool cash).
  return (
    depositDonationToPlatformEscrow(amount, memo, { donorProfileId }) !== null
  );
}

/** Each recurring donation gets its own schedule so same-day multiples all appear. */
function syncHomeContributionSchedule(
  profileId: string,
  amount: number,
  enabled: boolean,
  frequency: HomeContributionFrequency,
  contributionRecordId: string,
): void {
  if (!enabled) {
    disableRecurringSubscription(profileId);
    return;
  }

  const contributedYmd = formatEasternIsoDate();
  const nextStart = nextRecurringStart(frequency);

  addRecurringCashflow({
    id: donationScheduleIdForContribution(contributionRecordId),
    profileId,
    accountId: "escrow",
    type: "income",
    amount,
    frequency,
    label: HOME_CONTRIBUTION_LABEL,
    startDate: nextStart,
    lastProcessedDate: contributedYmd,
    settledDates: [contributedYmd],
  });

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

  const contributionRecord = appendDataRecord("contributions", "contribute-onboarding", {
    type: recurringEnabled ? "recurring" : "one-time",
    amount,
    reminderEnabled,
    recurringEnabled,
    frequency: recurringEnabled ? frequency : undefined,
    profileId,
    memberId: profileId,
    memberName: profile?.displayName || currentMember.name,
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
    syncHomeContributionSchedule(
      profile.id,
      amount,
      recurringEnabled,
      frequency,
      contributionRecord.id,
    );
  } else {
    syncHomeContributionSchedule(
      profileId,
      amount,
      recurringEnabled,
      frequency,
      contributionRecord.id,
    );
  }

  // Reconcile from contribution records so overview / calendar / list stay aligned.
  ensureHomeContributionSchedulesFromContributions(profileId);

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

  playCashSound();
  pushContributionBinsNow();
}

/**
 * Member wallet deposit — credits escrow and mirrors into the contributions bin
 * so Deposited / equity chips and pool inflow stay in sync with contribute flow.
 */
export function saveWalletDeposit({
  amount,
  memo,
}: {
  amount: number;
  memo?: string;
}) {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const { currentMember } = getPoolState();
  const profile = getActiveDadProfile();
  const profileId = profile?.id ?? resolveMemberProfileId();
  const note = memo?.trim() || "Wallet deposit";

  const ledger = depositToMemberWallet(profileId, amount, note);
  if (!ledger) return null;

  appendDataRecord("contributions", "wallet-deposit", {
    type: "wallet-deposit",
    amount,
    reminderEnabled: false,
    recurringEnabled: false,
    profileId,
    memberId: profileId,
    memberName: profile?.displayName || currentMember.name,
    handle: currentMember.handle,
    contributedAt: new Date().toISOString(),
    status: "completed",
    memo: note,
  });

  if (profile) {
    logProfileActivity({
      profileId: profile.id,
      proId: profile.proId,
      type: "donation",
      summary: `Wallet deposit of $${amount.toFixed(2)}`,
      payload: { amount, source: "wallet-deposit" },
    });
  }

  updateMemberAfterContribution(profile?.id ?? profileId, amount);
  registerContribution({
    amount,
    memberId: currentMember.id,
    memberName: currentMember.name,
    handle: currentMember.handle,
  });
  syncMemberEscrowToLiquidityPool();
  pushContributionBinsNow();

  return ledger;
}

export function saveAdminCapture(source: string, payload: Record<string, unknown>) {
  return appendDataRecord("adminCaptures", source, payload);
}
