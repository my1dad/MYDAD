import { useMemo, useSyncExternalStore } from "react";
import { isAdminProfile } from "../../config/admin";
import { resolveMembershipTier } from "../../config/memberProfile";
import type { DadProfile } from "./dadProfileStorage";
import { findDadProfileByProId, getDadProfileRevision, getDadProfiles, subscribeDadProfiles } from "./dadProfileStorage";
import {
  beginBulkWrite,
  endBulkWrite,
  getDatabaseRevision,
  getDatabaseSnapshot,
  readDataBin,
  subscribeInternalDatabase,
  upsertDataRecord,
  type StoredRecord,
} from "./internalDatabase";
import {
  buildHandle,
  findStoredMemberByProfileId,
  profileToMember,
  resolveMemberStatus,
  type Member,
} from "./memberRegistry";
import { computeMemberStatsFromContributions } from "./memberContributionStats";
import { getProfileActivityEvents } from "./profileActivity";
import type { MemberAccountTransaction } from "./memberAccounts";

export interface AdminMemberRecord extends Member {
  proId: string;
  password: string;
  email?: string;
  phone?: string;
  profilePhotoUrl?: string;
  referredByProId?: string;
  referredByName?: string;
  createdAt: string;
  lastLoginAt: string;
}

function memberRecordId(profileId: string): string {
  return `member-${profileId}`;
}

function toAdminMemberRecord(profile: DadProfile, stored?: Member): AdminMemberRecord {
  const member = stored ?? profileToMember(profile);
  const referrer = profile.referredByProId
    ? findDadProfileByProId(profile.referredByProId)
    : undefined;

  return {
    ...member,
    id: profile.id,
    profileId: profile.id,
    username: profile.username,
    name: member.name || profile.displayName,
    handle: member.handle || buildHandle(profile.username),
    tier: resolveMembershipTier(profile),
    joinedAt: member.joinedAt || profile.createdAt,
    status: resolveMemberStatus(profile),
    proId: profile.proId ?? "",
    password: profile.password,
    email: profile.email?.trim() || undefined,
    phone: profile.phone?.trim() || undefined,
    profilePhotoUrl: profile.profilePhotoUrl?.trim() || undefined,
    referredByProId: profile.referredByProId?.trim() || undefined,
    referredByName: referrer?.displayName,
    createdAt: profile.createdAt,
    lastLoginAt: profile.lastLoginAt,
    lastLogoutAt: member.lastLogoutAt,
  };
}

function memberToRegistryPayload(record: AdminMemberRecord): Record<string, unknown> {
  return {
    profileId: record.profileId ?? record.id,
    username: record.username,
    name: record.name,
    handle: record.handle,
    tier: record.tier,
    contributed: record.contributed,
    equity: record.equity,
    days: record.days,
    score: record.score,
    streak: record.streak,
    status: record.status,
    joinedAt: record.joinedAt,
    proId: record.proId,
    password: record.password,
    email: record.email,
    phone: record.phone,
    profilePhotoUrl: record.profilePhotoUrl,
    referredByProId: record.referredByProId,
    createdAt: record.createdAt,
    lastLoginAt: record.lastLoginAt,
    lastLogoutAt: record.lastLogoutAt,
    adminBalancesLocked: record.adminBalancesLocked === true,
  };
}

export function syncProfileToMemberRegistry(
  profile: DadProfile,
  extras: { lastLogoutAt?: string } = {},
): AdminMemberRecord {
  const stored = findStoredMemberByProfileId(profile.id);
  const record = toAdminMemberRecord(profile, stored);
  const contributionStats = computeMemberStatsFromContributions(profile.id);

  // Contributions bin is the worldwide source of truth for contributed / equity.
  record.contributed = contributionStats.contributed;
  record.equity = contributionStats.equity;
  record.days = contributionStats.days;
  record.streak = contributionStats.streak;
  if (contributionStats.days > 0) {
    record.score = Math.min(
      100,
      Math.max(record.score, 50 + contributionStats.days),
    );
  }

  if (extras.lastLogoutAt) {
    record.lastLogoutAt = extras.lastLogoutAt;
  }

  upsertDataRecord("members", memberRecordId(profile.id), "profile-registry-sync", {
    ...memberToRegistryPayload(record),
  });

  return record;
}

export function syncAllProfilesToMemberRegistry(): void {
  beginBulkWrite();
  try {
    getDadProfiles().forEach((profile) => {
      syncProfileToMemberRegistry(profile);
    });
  } finally {
    endBulkWrite();
  }
}

export function getAdminMemberRecords(): AdminMemberRecord[] {
  return getDadProfiles()
    .filter((profile) => !isAdminProfile(profile))
    .map((profile) => {
      const record = toAdminMemberRecord(profile, findStoredMemberByProfileId(profile.id));
      const stats = computeMemberStatsFromContributions(profile.id);
      record.contributed = stats.contributed;
      record.equity = stats.equity;
      if (stats.days > 0) record.days = stats.days;
      if (stats.streak > 0) record.streak = stats.streak;
      return record;
    })
    .sort((a, b) => {
      if ((a.status === "pending") !== (b.status === "pending")) {
        return a.status === "pending" ? -1 : 1;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

function expandBinRecord(record: StoredRecord): Record<string, unknown> & { id: string } {
  return { id: record.id, ...record.payload };
}

export function getContributionsForProfile(profileId: string) {
  return readDataBin("contributions").records
    .map(expandBinRecord)
    .filter((entry) => entry.profileId === profileId)
    .sort((a, b) =>
      String(b.contributedAt ?? "").localeCompare(String(a.contributedAt ?? "")),
    );
}

export function getPostsForProfile(profile: DadProfile) {
  const handle = buildHandle(profile.username);
  return readDataBin("communityPosts").records
    .map(expandBinRecord)
    .filter(
      (entry) =>
        entry.author === profile.displayName ||
        entry.handle === handle ||
        entry.handle === profile.username,
    )
    .sort((a, b) =>
      String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")),
    );
}

export function getAccountTransactionsForProfile(profileId: string): MemberAccountTransaction[] {
  const record = readDataBin("settings").records.find(
    (item) => item.id === `member-accounts-${profileId}`,
  );
  const transactions = Array.isArray(record?.payload?.transactions)
    ? (record.payload.transactions as MemberAccountTransaction[])
    : [];
  return [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProfileMemberRoi(record: Pick<Member, "contributed" | "equity">): {
  amount: number;
  pct: number;
} {
  const amount = record.equity - record.contributed;
  const pct =
    record.contributed > 0
      ? Math.round((amount / record.contributed) * 10000) / 100
      : 0;
  return { amount, pct };
}

export function buildAdminMemberDetail(profileId: string) {
  const profile = getDadProfiles().find((item) => item.id === profileId);
  if (!profile) return null;

  const record = toAdminMemberRecord(profile, findStoredMemberByProfileId(profileId));
  const stats = computeMemberStatsFromContributions(profileId);
  record.contributed = stats.contributed;
  record.equity = stats.equity;
  if (stats.days > 0) record.days = stats.days;
  if (stats.streak > 0) record.streak = stats.streak;

  return {
    record,
    profile,
    contributions: getContributionsForProfile(profileId),
    posts: getPostsForProfile(profile),
    activity: getProfileActivityEvents(profileId),
    transactions: getAccountTransactionsForProfile(profileId),
  };
}

export function useAdminMemberRecords(): AdminMemberRecord[] {
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    getDadProfileRevision,
  );

  return useMemo(() => {
    void dbRevision;
    void getDatabaseSnapshot();
    return getAdminMemberRecords();
  }, [dbRevision, profileRevision]);
}
