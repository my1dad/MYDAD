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
  findDadProfileById,
  findDadProfileByUsername,
  getDadProfileRevision,
  getDadProfiles,
  getProfileApprovalStatus,
  subscribeDadProfiles,
} from "./dadProfileStorage";
import { formatContributionDueLabel, formatEasternIsoDate } from "./dateTime";
import {
  appendDataRecord,
  beginBulkWrite,
  endBulkWrite,
  getDatabaseRevision,
  getDatabaseSnapshot,
  readDataBin,
  subscribeInternalDatabase,
  upsertDataRecord,
  writeDataBin,
  type StoredRecord,
} from "./internalDatabase";
import {
  computeMemberStatsFromContributions,
  listContributionProfileIds,
  memberStatsEqual,
} from "./memberContributionStats";
import { activateMemberSession, getPoolState, registerNewPoolMember } from "./poolState";

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
  /** When true, contribution reconcile keeps admin-set contributed/equity. */
  adminBalancesLocked?: boolean;
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

function enrichMemberWithProfileStatus(
  member: Member,
  profilesById?: Map<string, DadProfile>,
): Member {
  if (!member.profileId) return member;
  const profile = profilesById
    ? profilesById.get(member.profileId)
    : getDadProfiles().find((item) => item.id === member.profileId);
  if (!profile) return member;
  return { ...member, status: resolveMemberStatus(profile) };
}

const NON_APPROVED_MEMBER_STATUSES = new Set(["pending", "declined", "denied"]);

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
    adminBalancesLocked: payload.adminBalancesLocked === true,
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

export function getCanonicalAdminProfileId(): string | undefined {
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
    adminBalancesLocked: member.adminBalancesLocked === true,
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
    adminBalancesLocked: stored.adminBalancesLocked === true,
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
  const profiles = getDadProfiles();
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
  const storedByProfileId = new Map<string, Member>();
  getStoredMembers().forEach((member) => {
    storedByProfileId.set(member.profileId ?? member.id, member);
  });

  const fromProfiles = profiles
    .filter((profile) => getProfileApprovalStatus(profile) === "approved")
    .map((profile) =>
      mergeProfileWithStoredMember(profile, storedByProfileId.get(profile.id)),
    );

  const seen = new Set(fromProfiles.map((member) => member.profileId ?? member.id));

  // After a wipe, profiles can lag while the members bin (or cloud pull) already
  // has approved rows — keep those visible so the Members page is not empty.
  const fromBinOnly = getStoredMembers().filter((member) => {
    const id = member.profileId ?? member.id;
    if (seen.has(id)) return false;
    if (isAdminMember(member)) return true;
    const profile = profilesById.get(id);
    if (profile) return getProfileApprovalStatus(profile) === "approved";
    const status = member.status?.trim().toLowerCase();
    return !status || !NON_APPROVED_MEMBER_STATUSES.has(status);
  });

  return dedupeAdminMembers(
    [...fromProfiles, ...fromBinOnly].sort((a, b) => {
      const aTime = new Date(a.joinedAt ?? 0).getTime();
      const bTime = new Date(b.joinedAt ?? 0).getTime();
      return bTime - aTime;
    }),
  );
}

export function getMembersList(): Member[] {
  return getRegisteredMembers();
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
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  return useMemo(() => {
    void profileRevision;
    void dbRevision;
    // Profiles are the source of truth for the member directory (approved members).
    // The members bin may be empty after a wipe even when cloud profiles exist.
    return getRegisteredMembers();
  }, [profileRevision, dbRevision]);
}

export function useRegisteredMembers(): Member[] {
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    () => 0,
  );
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  return useMemo(() => {
    void profileRevision;
    void dbRevision;
    return getRegisteredMembers();
  }, [profileRevision, dbRevision]);
}

export function useAllProfileMembers(): Member[] {
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    () => 0,
  );
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  return useMemo(() => {
    void profileRevision;
    void dbRevision;
    return getAllProfileMembers();
  }, [profileRevision, dbRevision]);
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

function refreshPoolSessionFromMember(member: Member): void {
  const current = getPoolState().currentMember;
  const memberKey = member.profileId ?? member.id;
  if (current.id !== memberKey && current.id !== member.id) return;

  activateMemberSession({
    ...current,
    id: memberKey,
    name: member.name || current.name,
    handle: member.handle || current.handle,
    totalContributed: member.contributed,
    equityValue: member.equity,
    streakDays: member.streak,
    dailyContribution: member.days > 0 ? member.contributed / member.days : current.dailyContribution,
    loanEligibilityScore: member.score,
    loanStatus: member.score >= 70 ? "eligible" : current.loanStatus,
  });
}

/**
 * Rebuild contributed / equity / days / streak from the shared contributions bin
 * so Members + Liquidity Pool stay aligned across devices.
 */
export function applyMemberStatsFromContributions(profileId: string): boolean {
  if (!profileId) return false;

  const stats = computeMemberStatsFromContributions(profileId);
  const existing =
    findStoredMemberByProfileId(profileId) ??
    (() => {
      const profile = findDadProfileById(profileId);
      return profile ? profileToMember(profile) : undefined;
    })();

  if (!existing) return false;

  const contributed = existing.adminBalancesLocked ? existing.contributed : stats.contributed;
  const equity = existing.adminBalancesLocked ? existing.equity : stats.equity;

  const updated: Member = {
    ...existing,
    profileId: existing.profileId ?? profileId,
    id: existing.profileId ?? profileId,
    contributed,
    equity,
    days: stats.days,
    streak: stats.streak,
    score: Math.min(100, Math.max(existing.score, stats.days > 0 ? 50 + stats.days : existing.score)),
  };

  if (
    memberStatsEqual(existing, {
      contributed: updated.contributed,
      equity: updated.equity,
      days: updated.days,
      streak: updated.streak,
    }) &&
    existing.score === updated.score
  ) {
    return false;
  }

  upsertDataRecord(
    "members",
    memberRecordId(profileId),
    "contribution-stats-sync",
    memberToPayload(updated),
  );
  refreshPoolSessionFromMember(updated);
  return true;
}

/** Admin override: set directory contributed / equity for a member. */
export function adminSetMemberDirectoryBalances(
  profileId: string,
  balances: { contributed: number; equity: number },
): Member | null {
  if (!profileId) return null;

  const existing =
    findStoredMemberByProfileId(profileId) ??
    (() => {
      const profile = findDadProfileById(profileId);
      return profile ? profileToMember(profile) : undefined;
    })();

  if (!existing) return null;

  const updated: Member = {
    ...existing,
    profileId: existing.profileId ?? profileId,
    id: existing.profileId ?? profileId,
    contributed: Math.max(0, Math.round((Number(balances.contributed) || 0) * 100) / 100),
    equity: Math.max(0, Math.round((Number(balances.equity) || 0) * 100) / 100),
    adminBalancesLocked: true,
  };

  upsertDataRecord(
    "members",
    memberRecordId(profileId),
    "admin-balance-override",
    memberToPayload(updated),
  );
  refreshPoolSessionFromMember(updated);
  return updated;
}

/** Reconcile every member that has contribution history (and repair zeroed cloud rows). */
export function reconcileMembersFromContributions(): boolean {
  const profileIds = new Set<string>([
    ...listContributionProfileIds(),
    ...getStoredMembers().map((member) => member.profileId ?? member.id),
  ]);

  beginBulkWrite();
  let changed = false;
  try {
    profileIds.forEach((profileId) => {
      if (applyMemberStatsFromContributions(profileId)) changed = true;
    });
  } finally {
    endBulkWrite();
  }
  return changed;
}

export function updateMemberAfterContribution(
  profileId: string,
  _amount?: number,
): void {
  applyMemberStatsFromContributions(profileId);
}
