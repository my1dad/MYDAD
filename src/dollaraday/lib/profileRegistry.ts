import { useMemo, useSyncExternalStore } from "react";
import type { DadProfile } from "./dadProfileStorage";
import { findDadProfileByProId, getDadProfileRevision, getDadProfiles, subscribeDadProfiles } from "./dadProfileStorage";
import { getDatabaseSnapshot, readDataBin, subscribeInternalDatabase, upsertDataRecord, type StoredRecord } from "./internalDatabase";
import {
  buildHandle,
  findStoredMemberByProfileId,
  profileToMember,
  resolveMemberStatus,
  type Member,
} from "./memberRegistry";
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
    tier: member.tier || profile.role?.trim() || "Member",
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
  };
}

export function syncProfileToMemberRegistry(
  profile: DadProfile,
  extras: { lastLogoutAt?: string } = {},
): AdminMemberRecord {
  const stored = findStoredMemberByProfileId(profile.id);
  const record = toAdminMemberRecord(profile, stored);

  if (extras.lastLogoutAt) {
    record.lastLogoutAt = extras.lastLogoutAt;
  }

  upsertDataRecord("members", memberRecordId(profile.id), "profile-registry-sync", {
    ...memberToRegistryPayload(record),
  });

  return record;
}

export function syncAllProfilesToMemberRegistry(): void {
  getDadProfiles().forEach((profile) => {
    syncProfileToMemberRegistry(profile);
  });
}

export function getAdminMemberRecords(): AdminMemberRecord[] {
  return getDadProfiles()
    .map((profile) => toAdminMemberRecord(profile, findStoredMemberByProfileId(profile.id)))
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
  const snapshot = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseSnapshot,
    getDatabaseSnapshot,
  );
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    getDadProfileRevision,
  );

  return useMemo(() => {
    void snapshot.syncedAt;
    void snapshot.bins.members.records;
    void snapshot.bins.adminCaptures.records;
    void profileRevision;
    return getAdminMemberRecords();
  }, [snapshot.syncedAt, snapshot.bins.members.records, snapshot.bins.adminCaptures.records, profileRevision]);
}
