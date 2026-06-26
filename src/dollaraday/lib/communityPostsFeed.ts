import { useMemo, useSyncExternalStore } from "react";
import { communityPosts as seedPosts } from "../data/mockData";
import en from "../i18n/translations/en";
import es from "../i18n/translations/es";
import { useLocale } from "../i18n/LocaleContext";
import {
  getDatabaseSnapshot,
  subscribeInternalDatabase,
  type StoredRecord,
} from "./internalDatabase";
import { formatRelativeTimeFromIso } from "./dateTime";

function getLocale(): "en" | "es" {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem("dda-locale") === "es" ? "es" : "en";
}

function formatRelativeTime(iso: string): string {
  const locale = getLocale();
  const t = (key: string, vars: Record<string, string | number> = {}) => {
    const dict = locale === "es" ? es : en;
    const parts = key.split(".");
    let value: unknown = dict;
    for (const part of parts) {
      value = (value as Record<string, unknown>)?.[part];
    }
    if (typeof value !== "string") return key;
    return value.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`,
    );
  };

  return formatRelativeTimeFromIso(iso, t, locale);
}

export interface CommunityBoardPost {
  id: string;
  author: string;
  handle: string;
  profileId?: string;
  time: string;
  publishedAt?: string;
  title?: string;
  body: string;
  channelLabel?: string;
  likes: number;
  replies: number;
  pinned: boolean;
}

function storedRecordToPost(record: StoredRecord): CommunityBoardPost | null {
  const payload = record.payload;
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) return null;

  const title = typeof payload.title === "string" ? payload.title.trim() : "";

  return {
    id: record.id,
    author: typeof payload.author === "string" ? payload.author : "Member",
    handle: typeof payload.handle === "string" ? payload.handle : "",
    profileId: typeof payload.profileId === "string" ? payload.profileId : undefined,
    publishedAt:
      typeof payload.publishedAt === "string" ? payload.publishedAt : record.createdAt,
    time: formatRelativeTime(
      typeof payload.publishedAt === "string" ? payload.publishedAt : record.createdAt
    ),
    title: title || undefined,
    body,
    channelLabel:
      typeof payload.channelLabel === "string" ? payload.channelLabel : undefined,
    likes: 0,
    replies: 0,
    pinned: false,
  };
}

function seedPostToBoardPost(post: (typeof seedPosts)[number]): CommunityBoardPost {
  return {
    id: post.id,
    author: post.author,
    handle: post.handle,
    time: post.time,
    body: post.body,
    likes: post.likes,
    replies: post.replies,
    pinned: Boolean(post.pinned),
  };
}

export function getCommunityBoardPosts(): CommunityBoardPost[] {
  const stored = getDatabaseSnapshot()
    .bins.communityPosts.records.map(storedRecordToPost)
    .filter((post): post is CommunityBoardPost => post !== null);

  const seeded = seedPosts.map(seedPostToBoardPost);
  const storedIds = new Set(stored.map((post) => post.id));

  return [...stored, ...seeded.filter((post) => !storedIds.has(post.id))];
}

export function useCommunityBoardPosts(): CommunityBoardPost[] {
  const { locale } = useLocale();
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot
  );

  return useMemo(() => {
    const stored = snapshot.bins.communityPosts.records
      .map(storedRecordToPost)
      .filter((post): post is CommunityBoardPost => post !== null);

    const seeded = seedPosts.map(seedPostToBoardPost);
    const storedIds = new Set(stored.map((post) => post.id));

    return [...stored, ...seeded.filter((post) => !storedIds.has(post.id))];
  }, [snapshot.syncedAt, snapshot.bins.communityPosts.records, locale]);
}
