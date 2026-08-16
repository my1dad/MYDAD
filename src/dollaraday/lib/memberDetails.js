import { loans, loanEligibilityFactors } from "../data/mockData";
import { buildRecentEasternMonthDays, formatEasternIsoDate, subtractDays, easternNow } from "./dateTime";

const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function getMemberInitials(name) {
  const parts = String(name || "Member")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "M";
  return parts
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function hashHandle(handle = "") {
  return handle.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function mapPoolCurrentMemberToMember(currentMember) {
  return {
    id: currentMember.id,
    name: currentMember.name,
    handle: currentMember.handle,
    tier: currentMember.tier,
    contributed: currentMember.totalContributed,
    equity: currentMember.equityValue,
    days: currentMember.streakDays,
    score: currentMember.loanEligibilityScore,
    streak: currentMember.streakDays,
    status: "active",
  };
}

/** Resolve a donation row to a member profile for the detail modal. */
export function resolveMemberFromDonation(donation, membersList, poolCurrentMember = null) {
  const list = Array.isArray(membersList) ? membersList : [];
  const matched =
    list.find((member) => member.handle === donation?.handle) ??
    list.find((member) => member.name === donation?.member);

  if (matched) return { ...matched };

  if (
    poolCurrentMember &&
    (poolCurrentMember.handle === donation.handle || poolCurrentMember.name === donation.member)
  ) {
    return mapPoolCurrentMemberToMember(poolCurrentMember);
  }

  const handle = String(donation?.handle ?? "");
  const memberName = String(donation?.member ?? "Member");
  const amount = Number(donation?.amount) || 0;
  const seed = hashHandle(handle);
  const days = 45 + (seed % 280);
  const contributed = Math.max(Math.round(amount * days), Math.round(amount * 30));
  const score = 52 + (seed % 44);

  return {
    id: `guest-${handle.replace("@", "") || "member"}`,
    name: memberName,
    handle,
    tier: "Investor",
    contributed,
    equity: Math.round(contributed * 1.35),
    days,
    score,
    streak: donation.status === "pending" ? Math.max(0, days - 3) : days,
    status: donation.status === "pending" ? "paused" : "active",
  };
}

export function buildMemberDetail(member) {
  const memberLoans = loans.filter((loan) => loan.member === member.name);
  const equityGrowth = Math.max(0, member.equity - member.contributed);
  const poolShare = Math.round(member.equity * 0.12);

  const accounts = [
    { name: "Contributions", value: member.contributed, color: "var(--color-dda-green)" },
    { name: "Equity growth", value: equityGrowth, color: "#2563eb" },
    { name: "Pool allocation", value: poolShare, color: "var(--color-dda-gold-light)" },
  ];

  const contributionTrend = weekLabels.map((label, index) => ({
    label,
    amount: member.status === "paused" && index > 4 ? 0 : 1,
  }));

  const recentDays = buildRecentEasternMonthDays(7);
  const recentContributions = recentDays.map((date, index) => ({
    date,
    amount: member.status === "paused" && index < 2 ? 0 : 1,
    status: member.status === "paused" && index < 2 ? "missed" : "completed",
  }));

  const eligibility = loanEligibilityFactors.map((factor) => ({
    ...factor,
    score: Math.min(100, Math.round(factor.score * (member.score / 92))),
  }));

  const loanStatus =
    memberLoans.some((l) => l.status === "approved")
      ? "active loan"
      : memberLoans.some((l) => l.status === "in_review")
        ? "pending review"
        : member.score >= 70
          ? "eligible"
          : "not eligible";

  return {
    ...member,
    initials: getMemberInitials(member.name),
    memberSince: member.joinedAt?.slice(0, 10) ?? formatEasternIsoDate(subtractDays(easternNow(), member.days || 0)),
    accounts,
    accountTotal: accounts.reduce((sum, item) => sum + item.value, 0),
    contributionTrend,
    recentContributions,
    memberLoans,
    eligibility,
    loanStatus,
    avgDaily: member.days ? (member.contributed / member.days).toFixed(2) : "0.00",
  };
}
