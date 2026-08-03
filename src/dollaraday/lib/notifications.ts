import { useMemo, useSyncExternalStore } from "react";
import { isAdminProfile } from "../../config/admin";
import {
  getDmConversations,
  getDmReadRevision,
  markAllDmThreadsRead,
  markDmThreadRead,
  subscribeDmRead,
} from "./communityChat";
import {
  getActiveDadProfile,
  getDadProfileRevision,
  getDadProfiles,
  getDadSessionRevision,
  subscribeDadProfiles,
  subscribeDadSession,
} from "./dadProfileStorage";
import { getDatabaseRevision, readDataBin, subscribeInternalDatabase } from "./internalDatabase";
import { getProfileActivityEvents } from "./profileActivity";

export type DdaNotificationKind =
  | "community_dm"
  | "profile_pending"
  | "profile_approved"
  | "profile_denied"
  | "donation"
  | "wallet_deposit"
  | "recurring_donation";

export type DdaContributionNotifyType =
  | "wallet-deposit"
  | "recurring"
  | "one-time"
  | "other";

export interface DdaNotification {
  id: string;
  kind: DdaNotificationKind;
  occurredAt: string;
  unread: boolean;
  targetPage?: string;
  targetProfileId?: string;
  dmPartnerId?: string;
  senderName?: string;
  messageBody?: string;
  memberName?: string;
  donationAmount?: number;
  contributionType?: DdaContributionNotifyType;
  frequency?: string;
}

interface ContributionDonation {
  id: string;
  memberName: string;
  amount: number;
  contributedAt: string;
  profileId?: string;
  contributionType: DdaContributionNotifyType;
  frequency?: string;
}

function normalizeContributionType(rawType: string, source: string): DdaContributionNotifyType {
  if (rawType === "wallet-deposit" || source === "wallet-deposit") return "wallet-deposit";
  if (
    rawType === "recurring" ||
    source === "recurring-home-contribution" ||
    source === "recurring-automation"
  ) {
    return "recurring";
  }
  if (rawType === "one-time" || source === "contribute-onboarding") return "one-time";
  return "other";
}

function notificationKindForContribution(
  contributionType: DdaContributionNotifyType,
  forMemberSelf: boolean,
): DdaNotificationKind {
  if (!forMemberSelf) return "donation";
  if (contributionType === "wallet-deposit") return "wallet_deposit";
  if (contributionType === "recurring") return "recurring_donation";
  return "donation";
}

function getRecentDonations(limit = 50): ContributionDonation[] {
  return readDataBin("contributions")
    .records.map((record) => {
      const payload = record.payload;
      const amount = Number(payload.amount) || 0;
      const memberName =
        typeof payload.memberName === "string" ? payload.memberName.trim() : "";
      const contributedAt =
        typeof payload.contributedAt === "string" ? payload.contributedAt : record.createdAt;
      const rawType = typeof payload.type === "string" ? payload.type : "";
      const frequency = typeof payload.frequency === "string" ? payload.frequency : undefined;

      return {
        id: record.id,
        memberName,
        amount,
        contributedAt,
        profileId:
          typeof payload.profileId === "string"
            ? payload.profileId
            : typeof payload.memberId === "string"
              ? payload.memberId
              : undefined,
        type: rawType,
        status: typeof payload.status === "string" ? payload.status : "completed",
        contributionType: normalizeContributionType(rawType, record.source),
        frequency,
      };
    })
    .filter((entry) => {
      if (entry.type === "signup" || entry.amount <= 0) return false;
      if (entry.status && entry.status !== "completed") return false;
      return Boolean(entry.memberName);
    })
    .sort((a, b) => b.contributedAt.localeCompare(a.contributedAt))
    .slice(0, limit)
    .map(
      ({
        id,
        memberName,
        amount,
        contributedAt,
        profileId,
        contributionType,
        frequency,
      }) => ({
        id,
        memberName,
        amount,
        contributedAt,
        profileId,
        contributionType,
        frequency,
      }),
    );
}

const READ_KEY = "dollar-a-day-notification-read";
const DISMISSED_KEY = "dollar-a-day-notification-dismissed";

type ReadListener = () => void;
const readListeners = new Set<ReadListener>();

function notifyReadListeners() {
  readListeners.forEach((listener) => listener());
}

function subscribeReadState(listener: ReadListener): () => void {
  readListeners.add(listener);
  return () => readListeners.delete(listener);
}

function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeReadNotificationIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  notifyReadListeners();
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(({ touchCloudKv }) => touchCloudKv(READ_KEY));
  });
}

function getDismissedNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeDismissedNotificationIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  notifyReadListeners();
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(({ touchCloudKv }) => touchCloudKv(DISMISSED_KEY));
  });
}

export function markNotificationRead(notificationId: string) {
  if (notificationId.startsWith("dm-thread-")) {
    const profile = getActiveDadProfile();
    const otherProfileId = notificationId.slice("dm-thread-".length);
    if (profile && otherProfileId) {
      markDmThreadRead(profile.id, otherProfileId);
    }
    return;
  }

  const ids = getReadNotificationIds();
  if (ids.has(notificationId)) return;
  ids.add(notificationId);
  writeReadNotificationIds(ids);
}

export function markAllNotificationsRead(notificationIds: string[]) {
  const profile = getActiveDadProfile();
  const ids = getReadNotificationIds();
  let changed = false;

  notificationIds.forEach((id) => {
    if (id.startsWith("dm-thread-")) {
      const otherProfileId = id.slice("dm-thread-".length);
      if (profile && otherProfileId) {
        markDmThreadRead(profile.id, otherProfileId);
      }
      return;
    }
    if (!ids.has(id)) {
      ids.add(id);
      changed = true;
    }
  });

  if (profile) {
    markAllDmThreadsRead(profile.id);
  }

  if (changed) writeReadNotificationIds(ids);
}

export function clearMessageNotifications(notificationIds: string[]) {
  const dismissibleIds = notificationIds.filter((id) => !id.startsWith("pending-"));
  if (!dismissibleIds.length) return;

  markAllNotificationsRead(dismissibleIds);

  const dismissed = getDismissedNotificationIds();
  let changed = false;

  dismissibleIds.forEach((id) => {
    if (!dismissed.has(id)) {
      dismissed.add(id);
      changed = true;
    }
  });

  if (changed) writeDismissedNotificationIds(dismissed);
}

function buildNotifications(profileId: string | undefined, isAdmin: boolean): DdaNotification[] {
  const readIds = getReadNotificationIds();
  const dismissedIds = getDismissedNotificationIds();
  const items: DdaNotification[] = [];

  if (profileId) {
    getDmConversations(profileId)
      .filter((conversation) => conversation.unreadCount > 0)
      .forEach((conversation) => {
        items.push({
          id: `dm-thread-${conversation.otherProfileId}`,
          kind: "community_dm",
          senderName: conversation.otherName,
          messageBody: conversation.lastMessage,
          occurredAt: conversation.lastSentAt,
          unread: true,
          targetPage: "community",
          dmPartnerId: conversation.otherProfileId,
        });
      });

    getProfileActivityEvents(profileId, 50)
      .filter((event) => event.type === "profile_approve" || event.type === "profile_deny")
      .forEach((event) => {
        const id = `activity-${event.id}`;
        const approved = event.type === "profile_approve";
        items.push({
          id,
          kind: approved ? "profile_approved" : "profile_denied",
          messageBody: event.summary,
          occurredAt: event.occurredAt,
          unread: !readIds.has(id),
          targetPage: approved ? "dashboard" : undefined,
        });
      });
  }

  // Money alerts: admin sees platform-wide donations; members only see their own.
  getRecentDonations()
    .filter((donation) => {
      if (isAdmin) return true;
      if (!profileId) return false;
      return donation.profileId === profileId;
    })
    .forEach((donation) => {
      const id = `donation-${donation.id}`;
      const forMemberSelf = !isAdmin;
      items.push({
        id,
        kind: notificationKindForContribution(donation.contributionType, forMemberSelf),
        memberName: donation.memberName,
        donationAmount: donation.amount,
        contributionType: donation.contributionType,
        frequency: donation.frequency,
        occurredAt: donation.contributedAt,
        unread: !readIds.has(id),
        targetPage: isAdmin ? "allocations" : "accounts",
      });
    });

  if (isAdmin) {
    getDadProfiles()
      .filter((profile) => profile.approvalStatus === "pending" && !isAdminProfile(profile))
      .forEach((profile) => {
        const id = `pending-${profile.id}`;
        items.push({
          id,
          kind: "profile_pending",
          memberName: profile.displayName,
          messageBody: "pending",
          occurredAt: profile.createdAt,
          unread: true,
          targetPage: "admin",
          targetProfileId: profile.id,
        });
      });
  }

  return items
    .filter((item) => !dismissedIds.has(item.id))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getNotifications(isAdmin: boolean): DdaNotification[] {
  const profile = getActiveDadProfile();
  return buildNotifications(profile?.id, isAdmin);
}

export function useNotifications(isAdmin: boolean, profileId?: string | null) {
  const profileRevision = useSyncExternalStore(subscribeDadProfiles, getDadProfileRevision, () => 0);
  const sessionRevision = useSyncExternalStore(subscribeDadSession, getDadSessionRevision, () => 0);
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const readRevision = useSyncExternalStore(
    subscribeReadState,
    () => getReadNotificationIds().size + getDismissedNotificationIds().size,
    () => 0,
  );
  const dmReadRevision = useSyncExternalStore(subscribeDmRead, getDmReadRevision, () => 0);

  const activeProfileId = profileId ?? getActiveDadProfile()?.id;

  return useMemo(() => {
    void dbRevision;
    const notifications = buildNotifications(activeProfileId, isAdmin);
    const unreadCount = notifications.filter((item) => item.unread).length;
    return { notifications, unreadCount };
  }, [
    isAdmin,
    activeProfileId,
    profileRevision,
    sessionRevision,
    dbRevision,
    readRevision,
    dmReadRevision,
  ]);
}
