import { getActiveDadProfile } from "./dadProfileStorage";
import { appendDataRecord } from "./internalDatabase";
import { updateMemberAfterContribution } from "./memberRegistry";
import {
  disableRecurringSubscription,
  upsertRecurringSubscription,
} from "./recurringContributions";
import { getPoolState, registerContribution } from "./poolState";

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

  return appendDataRecord("communityPosts", "community-post-onboarding", {
    title,
    body,
    channelId,
    channelLabel,
    author: currentMember.name,
    handle: currentMember.handle,
    publishedAt: new Date().toISOString(),
  });
}

export function saveContribution({
  amount,
  reminderEnabled,
  recurringEnabled,
}: {
  amount: number;
  reminderEnabled: boolean;
  recurringEnabled: boolean;
}) {
  const { currentMember } = getPoolState();
  const profile = getActiveDadProfile();

  appendDataRecord("contributions", "contribute-onboarding", {
    type: "daily",
    amount,
    reminderEnabled,
    recurringEnabled,
    profileId: profile?.id ?? currentMember.id,
    memberId: currentMember.id,
    memberName: currentMember.name,
    handle: currentMember.handle,
    contributedAt: new Date().toISOString(),
    status: "completed",
  });

  registerContribution({
    amount,
    reminderEnabled,
    recurringEnabled,
    memberId: currentMember.id,
    memberName: currentMember.name,
    handle: currentMember.handle,
  });

  if (profile?.id) {
    updateMemberAfterContribution(profile.id, amount);

    if (recurringEnabled) {
      upsertRecurringSubscription({
        profileId: profile.id,
        memberId: currentMember.id,
        memberName: currentMember.name,
        handle: currentMember.handle,
        amount,
        enabled: true,
        reminderEnabled,
        markProcessedToday: true,
      });
    } else {
      disableRecurringSubscription(profile.id);
    }
  }
}

export function saveAdminCapture(source: string, payload: Record<string, unknown>) {
  return appendDataRecord("adminCaptures", source, payload);
}
