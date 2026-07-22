import { addEasternDays, formatEasternIsoDate } from "./dateTime";
import { readDataBin } from "./internalDatabase";

export interface MemberContributionStats {
  contributed: number;
  equity: number;
  days: number;
  streak: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isCompletedDonation(payload: Record<string, unknown>): boolean {
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (String(payload.type ?? "") === "signup") return false;
  return String(payload.status ?? "completed") === "completed";
}

function contributionProfileId(payload: Record<string, unknown>): string {
  return String(payload.profileId ?? payload.memberId ?? "").trim();
}

function contributionYmd(payload: Record<string, unknown>, fallback = ""): string {
  const raw = String(payload.contributedAt ?? fallback ?? "");
  if (!raw) return "";
  return formatEasternIsoDate(raw);
}

/** Consecutive contribution days ending on the latest donation day (0 if stale >1 day). */
export function computeContributionStreak(ymds: string[], today = formatEasternIsoDate()): number {
  const unique = Array.from(new Set(ymds.filter(Boolean))).sort((a, b) => b.localeCompare(a));
  if (!unique.length) return 0;

  const latest = unique[0];
  const yesterday = addEasternDays(today, -1);
  if (latest < yesterday) return 0;

  let streak = 0;
  let expected = latest;
  for (const ymd of unique) {
    if (ymd === expected) {
      streak += 1;
      expected = addEasternDays(expected, -1);
      continue;
    }
    if (ymd < expected) break;
  }
  return streak;
}

export function computeMemberStatsFromContributions(
  profileId: string,
  today = formatEasternIsoDate(),
): MemberContributionStats {
  const ymds: string[] = [];
  let contributed = 0;

  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (contributionProfileId(payload) !== profileId) return;
    if (!isCompletedDonation(payload)) return;

    contributed += Number(payload.amount);
    const ymd = contributionYmd(payload, record.createdAt);
    if (ymd) ymds.push(ymd);
  });

  const uniqueDays = Array.from(new Set(ymds));
  const days = uniqueDays.length;
  const rounded = roundMoney(contributed);

  return {
    contributed: rounded,
    // Equity tracks contribution capital until yield overlays are applied separately.
    equity: rounded,
    days,
    streak: computeContributionStreak(uniqueDays, today),
  };
}

/** Profile ids that have at least one completed contribution. */
export function listContributionProfileIds(): string[] {
  const ids = new Set<string>();
  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    if (!isCompletedDonation(payload)) return;
    const profileId = contributionProfileId(payload);
    if (profileId) ids.add(profileId);
  });
  return Array.from(ids);
}

export function memberStatsEqual(
  left: Pick<MemberContributionStats, "contributed" | "equity" | "days" | "streak">,
  right: Pick<MemberContributionStats, "contributed" | "equity" | "days" | "streak">,
): boolean {
  return (
    left.contributed === right.contributed &&
    left.equity === right.equity &&
    left.days === right.days &&
    left.streak === right.streak
  );
}
