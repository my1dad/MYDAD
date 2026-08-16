import { useMemo, useSyncExternalStore } from "react";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "./internalDatabase";
import {
  getStoredMembers,
  withLiveMemberBalances,
  type Member,
} from "./memberRegistry";
import { getMemberRedemptionsReceived } from "./redemptions";

export interface LeadershipEntry {
  rank: number;
  profileId: string;
  name: string;
  handle: string;
  /** Capital still invested with the platform (nets redemptions). */
  equity: number;
  /** Gross inflows — total invested / donated. */
  contributed: number;
  /** Fulfilled redemption payouts received. */
  redeemed: number;
  score: number;
  streak: number;
  status: string;
}

function isListedMember(member: Member): boolean {
  const username = member.username?.trim().toLowerCase();
  const handle = member.handle?.trim().toLowerCase();
  if (username === "admin" || handle === "@admin") return false;
  if (member.status === "declined") return false;
  return Boolean(member.profileId || member.id);
}

/**
 * Rank active members by investment equity (desc), then community score (desc).
 */
export function getCommunityLeadershipEntries(): LeadershipEntry[] {
  const ranked = getStoredMembers()
    .filter(isListedMember)
    .map((member) => withLiveMemberBalances(member))
    .map((member) => {
      const profileId = member.profileId ?? member.id;
      const redeemed = getMemberRedemptionsReceived(profileId).total;
      return {
        profileId,
        name: member.name,
        handle: member.handle || (member.username ? `@${member.username}` : ""),
        equity: Number(member.equity) || 0,
        contributed: Number(member.contributed) || 0,
        redeemed,
        score: Number(member.score) || 0,
        streak: Number(member.streak) || 0,
        status: member.status || "active",
      };
    })
    .sort((a, b) => {
      if (b.equity !== a.equity) return b.equity - a.equity;
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });

  return ranked.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

export function useCommunityLeadershipEntries(): LeadershipEntry[] {
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  return useMemo(() => {
    void dbRevision;
    return getCommunityLeadershipEntries();
  }, [dbRevision]);
}
