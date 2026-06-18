import { useMemo, useSyncExternalStore } from "react";
import type { DadProfile } from "./dadProfileStorage";
import { formatContributionDueLabel, formatEasternIsoDate } from "./dateTime";
import { members as seedMembers } from "../data/mockData";
import {
  appendDataRecord,
  getDatabaseSnapshot,
  subscribeInternalDatabase,
  upsertDataRecord,
  type StoredRecord,
} from "./internalDatabase";
import { activateMemberSession, registerNewPoolMember } from "./poolState";

export interface Member {
  id: string;
  profileId?: string;
  username?: string;
  name: string;
  handle: string;
  tier: string;
  contributed: number;
  equity: number;
  days: number;
  score: number;
  streak: number;
  status: string;
  joinedAt?: string;
}

function buildHandle(username: string): string {
  const clean = username.trim().replace(/^@+/, "");
  return `@${clean.toLowerCase()}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function profileToMember(profile: DadProfile): Member {
  return {
    id: profile.id,
    profileId: profile.id,
    username: profile.username,
    name: profile.displayName,
    handle: buildHandle(profile.username),
    tier: profile.role?.trim() || "Member",
    contributed: 0,
    equity: 0,
    days: 0,
    score: 50,
    streak: 0,
    status: "active",
    joinedAt: profile.createdAt,
  };
}

function payloadToMember(record: StoredRecord): Member | null {
  const payload = record.payload;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) return null;

  const handle =
    typeof payload.handle === "string" && payload.handle.trim()
      ? payload.handle.trim()
      : buildHandle(typeof payload.username === "string" ? payload.username : "member");

  return {
    id: typeof payload.profileId === "string" ? payload.profileId : record.id,
    profileId: typeof payload.profileId === "string" ? payload.profileId : undefined,
    username: typeof payload.username === "string" ? payload.username : undefined,
    name,
    handle,
    tier: typeof payload.tier === "string" ? payload.tier : "Member",
    contributed: Number(payload.contributed) || 0,
    equity: Number(payload.equity) || 0,
    days: Number(payload.days) || 0,
    score: Number(payload.score) || 50,
    streak: Number(payload.streak) || 0,
    status: typeof payload.status === "string" ? payload.status : "active",
    joinedAt: typeof payload.joinedAt === "string" ? payload.joinedAt : record.createdAt,
  };
}

function memberRecordId(profileId: string): string {
  return `member-${profileId}`;
}

function memberToPayload(member: Member): Record<string, unknown> {
  return {
    profileId: member.profileId ?? member.id,
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
  };
}

export function getStoredMembers(): Member[] {
  return getDatabaseSnapshot()
    .bins.members.records.map(payloadToMember)
    .filter((member): member is Member => member !== null);
}

export function findStoredMemberByProfileId(profileId: string): Member | undefined {
  return getStoredMembers().find(
    (member) => member.profileId === profileId || member.id === profileId,
  );
}

export function getMembersList(): Member[] {
  const stored = getStoredMembers();
  const storedProfileIds = new Set(
    stored.map((member) => member.profileId ?? member.id),
  );

  const seeded = seedMembers.filter(
    (member) => !storedProfileIds.has(member.id) && !stored.some((s) => s.id === member.id),
  );

  return [...stored, ...seeded];
}

export function useFeaturedMembers(limit = 3): Member[] {
  const members = useMembers();

  return useMemo(() => {
    const registered = members
      .filter((member) => member.profileId)
      .sort((a, b) => {
        const aTime = new Date(a.joinedAt ?? 0).getTime();
        const bTime = new Date(b.joinedAt ?? 0).getTime();
        return bTime - aTime;
      });

    if (registered.length >= limit) {
      return registered.slice(0, limit);
    }

    const seed = members.filter((member) => !member.profileId);
    return [...registered, ...seed].slice(0, limit);
  }, [members, limit]);
}

export function useMembers(): Member[] {
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );

  return useMemo(() => {
    const stored = snapshot.bins.members.records
      .map(payloadToMember)
      .filter((member): member is Member => member !== null);

    const storedIds = new Set(stored.map((member) => member.id));
    const storedProfileIds = new Set(
      stored.map((member) => member.profileId ?? member.id),
    );

    const seeded = seedMembers.filter(
      (member) => !storedIds.has(member.id) && !storedProfileIds.has(member.id),
    );

    return [...stored, ...seeded];
  }, [snapshot.syncedAt, snapshot.bins.members.records]);
}

export function persistMemberFromProfile(
  profile: DadProfile,
  options: { isNew?: boolean } = {},
): Member {
  const member = findStoredMemberByProfileId(profile.id) ?? profileToMember(profile);

  upsertDataRecord("members", memberRecordId(profile.id), "profile-registration", memberToPayload(member));

  if (options.isNew) {
    appendDataRecord("contributions", "profile-registration", {
      type: "signup",
      amount: 0,
      status: "pending",
      profileId: profile.id,
      memberId: member.id,
      memberName: member.name,
      handle: member.handle,
      username: profile.username,
      contributedAt: profile.createdAt,
      note: "Account created — awaiting first $1 contribution",
    });

    registerNewPoolMember({
      id: member.id,
      name: member.name,
      handle: member.handle,
      avatarInitials: getInitials(member.name),
      tier: member.tier,
      memberSince: formatEasternIsoDate(profile.createdAt ?? new Date()),
      dailyContribution: 0,
      totalContributed: 0,
      equityValue: 0,
      streakDays: 0,
      loanEligibilityScore: member.score,
      loanStatus: "pending",
      nextContributionDue: formatContributionDueLabel(),
    });
  } else {
    activateMemberSession({
      id: member.id,
      name: member.name,
      handle: member.handle,
      avatarInitials: getInitials(member.name),
      tier: member.tier,
      memberSince: (member.joinedAt ?? profile.lastLoginAt).slice(0, 10),
      dailyContribution: member.contributed > 0 ? 1 : 0,
      totalContributed: member.contributed,
      equityValue: member.equity,
      streakDays: member.streak,
      loanEligibilityScore: member.score,
      loanStatus: member.score >= 70 ? "eligible" : "pending",
      nextContributionDue: formatContributionDueLabel(),
    });
  }

  return member;
}

export function updateMemberAfterContribution(
  profileId: string,
  amount: number,
): void {
  const existing = findStoredMemberByProfileId(profileId);
  if (!existing) return;

  const updated: Member = {
    ...existing,
    contributed: existing.contributed + amount,
    equity: existing.equity + amount,
    days: existing.days + 1,
    streak: existing.streak + 1,
    score: Math.min(100, existing.score + 1),
  };

  upsertDataRecord(
    "members",
    memberRecordId(profileId),
    "contribution-sync",
    memberToPayload(updated),
  );
}
