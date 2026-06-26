import { useMemo, useSyncExternalStore } from "react";
import {
  getActiveDadProfile,
  getDadSessionRevision,
  subscribeDadSession,
} from "./dadProfileStorage";
import { appendDataRecord, getDatabaseSnapshot, readDataBin, subscribeInternalDatabase } from "./internalDatabase";

export const COMMUNITY_ROOM_SOURCE = "community-room";
export const COMMUNITY_DM_SOURCE = "community-dm";

export interface CommunityRoomMessage {
  id: string;
  fromProfileId: string;
  fromName: string;
  fromHandle: string;
  body: string;
  sentAt: string;
}

export interface CommunityDmMessage {
  id: string;
  fromProfileId: string;
  fromName: string;
  fromHandle: string;
  toProfileId: string;
  toName?: string;
  body: string;
  sentAt: string;
}

export interface DmConversation {
  otherProfileId: string;
  otherName: string;
  otherHandle: string;
  lastMessage: string;
  lastSentAt: string;
  unreadCount: number;
}

function parseRoomRecord(record: {
  id: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): CommunityRoomMessage | null {
  const body = typeof record.payload.body === "string" ? record.payload.body.trim() : "";
  const fromProfileId =
    typeof record.payload.fromProfileId === "string" ? record.payload.fromProfileId : "";
  if (!body || !fromProfileId) return null;

  return {
    id: record.id,
    fromProfileId,
    fromName: typeof record.payload.fromName === "string" ? record.payload.fromName : "Member",
    fromHandle: typeof record.payload.fromHandle === "string" ? record.payload.fromHandle : "",
    body,
    sentAt:
      typeof record.payload.sentAt === "string" ? record.payload.sentAt : record.createdAt,
  };
}

function parseDmRecord(record: {
  id: string;
  createdAt: string;
  payload: Record<string, unknown>;
}): CommunityDmMessage | null {
  const body = typeof record.payload.body === "string" ? record.payload.body.trim() : "";
  const fromProfileId =
    typeof record.payload.fromProfileId === "string" ? record.payload.fromProfileId : "";
  const toProfileId =
    typeof record.payload.toProfileId === "string" ? record.payload.toProfileId : "";
  if (!body || !fromProfileId || !toProfileId) return null;

  return {
    id: record.id,
    fromProfileId,
    fromName: typeof record.payload.fromName === "string" ? record.payload.fromName : "Member",
    fromHandle: typeof record.payload.fromHandle === "string" ? record.payload.fromHandle : "",
    toProfileId,
    toName: typeof record.payload.toName === "string" ? record.payload.toName : undefined,
    body,
    sentAt:
      typeof record.payload.sentAt === "string" ? record.payload.sentAt : record.createdAt,
  };
}

function getChatRecords() {
  return readDataBin("adminCaptures").records;
}

export function getCommunityRoomMessages(): CommunityRoomMessage[] {
  return getChatRecords()
    .filter((record) => record.source === COMMUNITY_ROOM_SOURCE)
    .map(parseRoomRecord)
    .filter((message): message is CommunityRoomMessage => message !== null)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export function getAllCommunityDirectMessages(): CommunityDmMessage[] {
  return getChatRecords()
    .filter((record) => record.source === COMMUNITY_DM_SOURCE)
    .map(parseDmRecord)
    .filter((message): message is CommunityDmMessage => message !== null)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export function getCommunityDirectMessages(profileId?: string): CommunityDmMessage[] {
  const messages = getAllCommunityDirectMessages();
  if (!profileId) return messages;
  return messages.filter(
    (message) => message.toProfileId === profileId || message.fromProfileId === profileId,
  );
}

export function getDmThread(
  profileId: string,
  otherProfileId: string,
): CommunityDmMessage[] {
  return getAllCommunityDirectMessages().filter(
    (message) =>
      (message.fromProfileId === profileId && message.toProfileId === otherProfileId) ||
      (message.fromProfileId === otherProfileId && message.toProfileId === profileId),
  );
}

const DM_READ_KEY = "dollar-a-day-dm-read";

function getDmReadMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DM_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDmReadMap(map: Record<string, string>) {
  localStorage.setItem(DM_READ_KEY, JSON.stringify(map));
  dmReadRevision += 1;
  notifyDmReadListeners();
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(({ touchCloudKv }) => touchCloudKv(DM_READ_KEY));
  });
}

type DmReadListener = () => void;
const dmReadListeners = new Set<DmReadListener>();
let dmReadRevision = 0;

function notifyDmReadListeners() {
  dmReadListeners.forEach((listener) => listener());
}

export function subscribeDmRead(listener: DmReadListener): () => void {
  dmReadListeners.add(listener);
  return () => dmReadListeners.delete(listener);
}

export function getDmReadRevision(): number {
  return dmReadRevision;
}

function dmThreadReadKey(viewerProfileId: string, otherProfileId: string): string {
  return `${viewerProfileId}:${otherProfileId}`;
}

export function markDmThreadRead(profileId: string, otherProfileId: string) {
  const map = getDmReadMap();
  map[dmThreadReadKey(profileId, otherProfileId)] = new Date().toISOString();
  writeDmReadMap(map);
}

export function getDmConversations(profileId: string): DmConversation[] {
  const messages = getCommunityDirectMessages(profileId);
  const byOther = new Map<string, CommunityDmMessage[]>();
  const readMap = getDmReadMap();

  messages.forEach((message) => {
    const otherId =
      message.fromProfileId === profileId ? message.toProfileId : message.fromProfileId;
    const bucket = byOther.get(otherId) ?? [];
    bucket.push(message);
    byOther.set(otherId, bucket);
  });

  return [...byOther.entries()]
    .map(([otherProfileId, thread]) => {
      const sorted = [...thread].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
      const last = sorted[sorted.length - 1];
      const otherMessage = thread.find((m) => m.fromProfileId === otherProfileId);
      const lastRead = readMap[dmThreadReadKey(profileId, otherProfileId)];
      const unreadCount = sorted.filter(
        (m) =>
          m.fromProfileId === otherProfileId &&
          (!lastRead || m.sentAt.localeCompare(lastRead) > 0),
      ).length;

      const partnerName =
        otherMessage?.fromName ??
        last.toName ??
        (last.fromProfileId === otherProfileId ? last.fromName : "Member");

      const partnerHandle =
        otherMessage?.fromHandle ??
        (last.fromProfileId === otherProfileId ? last.fromHandle : "");

      return {
        otherProfileId,
        otherName: partnerName,
        otherHandle: partnerHandle,
        lastMessage: last.body,
        lastSentAt: last.sentAt,
        unreadCount,
      };
    })
    .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
}

export function getTotalUnreadDmCount(profileId: string): number {
  return getDmConversations(profileId).reduce((sum, conversation) => sum + conversation.unreadCount, 0);
}

export function hasUnreadDmFromPartner(profileId: string, otherProfileId: string): boolean {
  const conversation = getDmConversations(profileId).find(
    (item) => item.otherProfileId === otherProfileId,
  );
  return (conversation?.unreadCount ?? 0) > 0;
}

export function markAllDmThreadsRead(profileId: string): void {
  getDmConversations(profileId).forEach((conversation) => {
    if (conversation.unreadCount > 0) {
      markDmThreadRead(profileId, conversation.otherProfileId);
    }
  });
}

export function useUnreadDmState(profileId?: string) {
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );
  const readRevision = useSyncExternalStore(subscribeDmRead, getDmReadRevision, () => 0);
  const sessionRevision = useSyncExternalStore(subscribeDadSession, getDadSessionRevision, () => 0);

  return useMemo(() => {
    if (!profileId) {
      return { totalUnread: 0, hasUnreadFrom: () => false };
    }

    const conversations = getDmConversations(profileId);
    const unreadByPartner = new Map(
      conversations.map((conversation) => [
        conversation.otherProfileId,
        conversation.unreadCount > 0,
      ]),
    );

    return {
      totalUnread: conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0),
      hasUnreadFrom: (otherProfileId: string) => unreadByPartner.get(otherProfileId) ?? false,
    };
  }, [profileId, sessionRevision, snapshot.syncedAt, snapshot.bins.adminCaptures.records, readRevision]);
}

type SendResult = { ok: true } | { ok: false; error: string };

function validateOutgoingMessage(body: string, senderId?: string): SendResult | { trimmed: string } {
  if (!senderId) {
    return { ok: false, error: "Sign in to send a message." };
  }

  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return { ok: false, error: "Message is empty." };
  }

  return { trimmed };
}

export function sendCommunityRoomMessage(body: string): SendResult {
  const sender = getActiveDadProfile();
  const validated = validateOutgoingMessage(body, sender?.id);
  if ("ok" in validated) return validated;

  appendDataRecord("adminCaptures", COMMUNITY_ROOM_SOURCE, {
    fromProfileId: sender!.id,
    fromName: sender!.displayName,
    fromHandle: `@${sender!.username}`,
    body: validated.trimmed,
    sentAt: new Date().toISOString(),
  });

  return { ok: true };
}

export function sendCommunityDirectMessage({
  toProfileId,
  body,
  recipientName,
}: {
  toProfileId: string;
  body: string;
  recipientName?: string;
  replyToPostId?: string;
}): SendResult & { message?: CommunityDmMessage } {
  const sender = getActiveDadProfile();
  const validated = validateOutgoingMessage(body, sender?.id);
  if ("ok" in validated) return validated;

  if (toProfileId === sender!.id) {
    return { ok: false, error: "You cannot message yourself." };
  }

  const record = appendDataRecord("adminCaptures", COMMUNITY_DM_SOURCE, {
    fromProfileId: sender!.id,
    fromName: sender!.displayName,
    fromHandle: `@${sender!.username}`,
    toProfileId,
    toName: recipientName,
    body: validated.trimmed,
    sentAt: new Date().toISOString(),
  });

  const message = parseDmRecord(record);
  return message ? { ok: true, message } : { ok: true };
}

export function useCommunityRoomMessages(): CommunityRoomMessage[] {
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );

  return useMemo(
    () =>
      snapshot.bins.adminCaptures.records
        .filter((record) => record.source === COMMUNITY_ROOM_SOURCE)
        .map(parseRoomRecord)
        .filter((message): message is CommunityRoomMessage => message !== null)
        .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
    [snapshot.syncedAt, snapshot.bins.adminCaptures.records],
  );
}

export function useCommunityChat(profileId?: string) {
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );
  const dmReadRevision = useSyncExternalStore(subscribeDmRead, getDmReadRevision, () => 0);
  const sessionRevision = useSyncExternalStore(subscribeDadSession, getDadSessionRevision, () => 0);

  return useMemo(() => {
    const roomMessages = snapshot.bins.adminCaptures.records
      .filter((record) => record.source === COMMUNITY_ROOM_SOURCE)
      .map(parseRoomRecord)
      .filter((message): message is CommunityRoomMessage => message !== null)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));

    const dmMessages = snapshot.bins.adminCaptures.records
      .filter((record) => record.source === COMMUNITY_DM_SOURCE)
      .map(parseDmRecord)
      .filter((message): message is CommunityDmMessage => message !== null);

    const conversations = profileId ? getDmConversations(profileId) : [];

    return { roomMessages, dmMessages, conversations };
  }, [profileId, sessionRevision, snapshot.syncedAt, snapshot.bins.adminCaptures.records, dmReadRevision]);
}
