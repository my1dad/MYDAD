import { useMemo, useSyncExternalStore } from "react";
import {
  ADMIN_ROLE,
  ADMIN_USERNAME,
  ADMIN_WORKSPACE_NAME,
  isAdminProfile,
} from "../../config/admin";
import { MEMBER_PROFILE_TEMPLATE } from "../../config/memberProfile";
import type { DadProfile } from "./dadProfileStorage";
import {
  findDadProfileByUsername,
  getDadProfileRevision,
  getDadProfiles,
  getProfileApprovalStatus,
  subscribeDadProfiles,
} from "./dadProfileStorage";
import { formatContributionDueLabel, formatEasternIsoDate } from "./dateTime";
import { members as seedMembers } from "../data/mockData";
import {
  appendDataRecord,
  getDatabaseSnapshot,
  readDataBin,
  subscribeInternalDatabase,
  upsertDataRecord,
  writeDataBin,
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
  proId?: string;
  email?: string;
  phone?: string;
  profilePhotoUrl?: string;
  referredByProId?: string;
  lastLogoutAt?: string;
}

export function buildHandle(username: string): string {
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
  const isMember = !isAdminProfile(profile);
  return {
    id: profile.id,
    profileId: profile.id,
    username: profile.username,
    name: profile.displayName,
    handle: buildHandle(profile.username),
    tier: profile.role?.trim() || (isMember ? MEMBER_PROFILE_TEMPLATE.tier : "Member"),
    contributed: isMember ? MEMBER_PROFILE_TEMPLATE.contributed : 0,
    equity: isMember ? MEMBER_PROFILE_TEMPLATE.equity : 0,
    days: isMember ? MEMBER_PROFILE_TEMPLATE.days : 0,
    score: isMember ? MEMBER_PROFILE_TEMPLATE.score : 50,
    streak: isMember ? MEMBER_PROFILE_TEMPLATE.streak : 0,
    status: resolveMemberStatus(profile),
    joinedAt: profile.createdAt,
  };
}

export function resolveMemberStatus(profile: DadProfile): string {
  const approval = getProfileApprovalStatus(profile);
  if (approval === "pending") return "pending";
  if (approval === "denied") return "declined";
  if (profile.accountStatus === "suspended") return "paused";
  return "active";
}

function enrichMemberWithProfileStatus(member: Member): Member {
  if (!member.profileId) return member;
  const profile = getDadProfiles().find((item) => item.id === member.profileId);
  if (!profile) return member;
  return { ...member, status: resolveMemberStatus(profile) };
}

const NON_APPROVED_MEMBER_STATUSES = new Set(["pending", "declined", "denied"]);

function isApprovedDirectoryMember(member: Member): boolean {
  if (isAdminMember(member)) return true;

  if (member.profileId) {
    const profile = getDadProfiles().find((item) => item.id === member.profileId);
    if (!profile) return false;
    return getProfileApprovalStatus(profile) === "approved";
  }

  const memberStatus = member.status?.trim().toLowerCase();
  if (memberStatus && NON_APPROVED_MEMBER_STATUSES.has(memberStatus)) return false;
  return true;
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
    proId: typeof payload.proId === "string" ? payload.proId : undefined,
    email: typeof payload.email === "string" ? payload.email : undefined,
    phone: typeof payload.phone === "string" ? payload.phone : undefined,
    referredByProId:
      typeof payload.referredByProId === "string" ? payload.referredByProId : undefined,
    lastLogoutAt: typeof payload.lastLogoutAt === "string" ? payload.lastLogoutAt : undefined,
  };
}

function memberRecordId(profileId: string): string {
  return `member-${profileId}`;
}

function isAdminMember(member: Member): boolean {
  const username = member.username?.trim().toLowerCase();
  return (
    username === ADMIN_USERNAME ||
    member.handle === buildHandle(ADMIN_USERNAME) ||
    member.name === ADMIN_WORKSPACE_NAME ||
    member.tier === ADMIN_ROLE
  );
}

function getCanonicalAdminProfileId(): string | undefined {
  return findDadProfileByUsername(ADMIN_USERNAME)?.id;
}

function dedupeAdminMembers(members: Member[]): Member[] {
  const adminMembers = members.filter(isAdminMember);
  if (adminMembers.length <= 1) return members;

  const canonicalProfileId = getCanonicalAdminProfileId();
  const keeper =
    (canonicalProfileId
      ? adminMembers.find(
          (member) =>
            member.profileId === canonicalProfileId || member.id === canonicalProfileId,
        )
      : undefined) ??
    [...adminMembers].sort((a, b) => {
      const aTime = new Date(a.joinedAt ?? 0).getTime();
      const bTime = new Date(b.joinedAt ?? 0).getTime();
      return bTime - aTime;
    })[0];

  const keeperKey = keeper.profileId ?? keeper.id;
  return members.filter(
    (member) => !isAdminMember(member) || (member.profileId ?? member.id) === keeperKey,
  );
}

export function pruneDuplicateAdminMemberRecords(): void {
  const bin = readDataBin("members");
  const canonicalProfileId = getCanonicalAdminProfileId();
  if (!canonicalProfileId) return;

  const canonicalRecordId = memberRecordId(canonicalProfileId);
  let changed = false;

  const records = bin.records.filter((record) => {
    const member = payloadToMember(record);
    if (!member || !isAdminMember(member)) return true;

    const keep =
      record.id === canonicalRecordId ||
      member.profileId === canonicalProfileId ||
      member.id === canonicalProfileId;

    if (!keep) changed = true;
    return keep;
  });

  if (!changed) return;

  writeDataBin("members", {
    ...bin,
    records,
  });
}

function mergeMemberLists(stored: Member[], seeded: Member[]): Member[] {
  return dedupeAdminMembers([...stored, ...seeded]);
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

function mergeProfileWithStoredMember(profile: DadProfile, stored?: Member): Member {
  const base = profileToMember(profile);
  if (!stored) return base;

  return {
    ...base,
    contributed: stored.contributed,
    equity: stored.equity,
    days: stored.days,
    score: stored.score,
    streak: stored.streak,
    status: resolveMemberStatus(profile),
    name: stored.name.trim() || profile.displayName,
    handle: stored.handle || buildHandle(profile.username),
    tier: stored.tier || profile.role?.trim() || "Member",
    joinedAt: stored.joinedAt || profile.createdAt,
    username: profile.username,
    profileId: profile.id,
    id: profile.id,
    proId: profile.proId ?? stored.proId,
    email: profile.email ?? stored.email,
    phone: profile.phone ?? stored.phone,
    profilePhotoUrl: profile.profilePhotoUrl ?? stored.profilePhotoUrl,
    referredByProId: profile.referredByProId ?? stored.referredByProId,
  };
}

/** All local profiles for community chat (includes pending, approved, denied). */
export function getAllProfileMembers(): Member[] {
  const storedByProfileId = new Map<string, Member>();
  getStoredMembers().forEach((member) => {
    storedByProfileId.set(member.profileId ?? member.id, member);
  });

  return dedupeAdminMembers(
    getDadProfiles()
      .map((profile) =>
        enrichMemberWithProfileStatus(
          mergeProfileWithStoredMember(profile, storedByProfileId.get(profile.id)),
        ),
      )
      .sort((a, b) => {
        const aTime = new Date(a.joinedAt ?? 0).getTime();
        const bTime = new Date(b.joinedAt ?? 0).getTime();
        return bTime - aTime;
      }),
  );
}

/** Every dashboard profile merged with stored member stats (admin directory source of truth). */
export function getRegisteredMembers(): Member[] {
  const storedByProfileId = new Map<string, Member>();
  getStoredMembers().forEach((member) => {
    storedByProfileId.set(member.profileId ?? member.id, member);
  });

  const fromProfiles = getDadProfiles()
    .filter((profile) => getProfileApprovalStatus(profile) === "approved")
    .map((profile) =>
    mergeProfileWithStoredMember(profile, storedByProfileId.get(profile.id)),
  );

  return dedupeAdminMembers(
    fromProfiles.sort((a, b) => {
      const aTime = new Date(a.joinedAt ?? 0).getTime();
      const bTime = new Date(b.joinedAt ?? 0).getTime();
      return bTime - aTime;
    }),
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

  return mergeMemberLists(stored, seeded)
    .map(enrichMemberWithProfileStatus)
    .filter(isApprovedDirectoryMember);
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
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    () => 0,
  );
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

    return mergeMemberLists(stored, seeded)
      .map(enrichMemberWithProfileStatus)
      .filter(isApprovedDirectoryMember);
  }, [profileRevision, snapshot.syncedAt, snapshot.bins.members.records]);
}

export function useRegisteredMembers(): Member[] {
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );

  return useMemo(() => {
    void snapshot.syncedAt;
    void snapshot.bins.members.records;
    return getRegisteredMembers();
  }, [snapshot.syncedAt, snapshot.bins.members.records]);
}

export function useAllProfileMembers(): Member[] {
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    () => 0,
  );
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );

  return useMemo(() => {
    void profileRevision;
    void snapshot.syncedAt;
    void snapshot.bins.members.records;
    return getAllProfileMembers();
  }, [profileRevision, snapshot.syncedAt, snapshot.bins.members.records]);
}

export function persistMemberFromProfile(
  profile: DadProfile,
  options: { isNew?: boolean } = {},
): Member {
  if (isAdminProfile(profile)) {
    pruneDuplicateAdminMemberRecords();
  }

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
