import type { MemberAccountTransaction } from "./memberAccounts";
import type { TodayDonation } from "./poolState";
import {
  easternNow,
  formatEasternIsoDate,
  formatEasternTimeWithZone,
  subtractDays,
} from "./dateTime";
import { readDataBin } from "./internalDatabase";

const MEMBER_ACCOUNTS_PREFIX = "member-accounts-";

export interface PoolInflowMetrics {
  dailyInflow: number;
  monthlyInflow: number;
  todaysDonations: TodayDonation[];
  dailyAllocationSummary: {
    totalDonations: number;
    totalAmount: number;
    uniqueContributors: number;
    pending: number;
    lastUpdatedAt: string;
  };
  allocationComparisonCurrent: {
    yesterday: number;
    "last-week": number;
    "last-month": number;
    milestone: number;
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isSameMonth(ymd: string, refYmd: string): boolean {
  return ymd.slice(0, 7) === refYmd.slice(0, 7);
}

/** Credits that bring money into the Chase Escrow account (pool cash). */
function isPoolInflowCredit(transaction: MemberAccountTransaction): boolean {
  if (transaction.direction !== "credit") return false;
  if (transaction.accountId !== "escrow") return false;

  const amount = Number(transaction.amount);
  return Number.isFinite(amount) && amount > 0;
}

function collectMemberAccountTransactions(): MemberAccountTransaction[] {
  const transactions: MemberAccountTransaction[] = [];

  readDataBin("settings")
    .records.filter((record) => record.id.startsWith(MEMBER_ACCOUNTS_PREFIX))
    .forEach((record) => {
      const rows = Array.isArray(record.payload?.transactions)
        ? (record.payload.transactions as MemberAccountTransaction[])
        : [];

      transactions.push(...rows);
    });

  return transactions;
}

interface ContributionRow {
  id: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  type: string;
  memberId: string;
  memberName: string;
  handle: string;
  contributedAt: string;
}

function readContributionRows(): ContributionRow[] {
  return readDataBin("contributions").records.flatMap((record) => {
    const payload = record.payload ?? {};
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount)) return [];

    const statusRaw = String(payload.status ?? "completed");
    const status =
      statusRaw === "completed" || statusRaw === "pending" || statusRaw === "failed"
        ? statusRaw
        : "completed";

    return [
      {
        id: record.id,
        amount,
        status,
        type: String(payload.type ?? ""),
        memberId: String(payload.memberId ?? record.id),
        memberName: String(payload.memberName ?? "Member"),
        handle: String(payload.handle ?? ""),
        contributedAt: String(payload.contributedAt ?? record.updatedAt ?? record.createdAt ?? ""),
      },
    ];
  });
}

function contributionYmd(contributedAt: string): string {
  if (!contributedAt) return "";
  return formatEasternIsoDate(contributedAt);
}

function isCountableDonation(row: ContributionRow): boolean {
  return row.type !== "signup" && row.amount > 0 && row.status === "completed";
}

function buildTodaysDonations(rows: ContributionRow[], today: string): {
  todaysDonations: TodayDonation[];
  dailyAllocationSummary: PoolInflowMetrics["dailyAllocationSummary"];
} {
  const todaysDonations: TodayDonation[] = [];
  const seenContributors = new Set<string>();
  let totalAmount = 0;
  let pending = 0;
  let lastUpdatedAt = "";

  rows.forEach((row) => {
    const ymd = contributionYmd(row.contributedAt);
    if (ymd !== today) return;

    if (row.status === "pending" || (row.type === "signup" && row.status !== "completed")) {
      pending += 1;
      return;
    }

    if (!isCountableDonation(row)) return;

    todaysDonations.push({
      id: row.id,
      member: row.memberName,
      handle: row.handle,
      amount: row.amount,
      time: formatEasternTimeWithZone(new Date(row.contributedAt)),
      status: "completed",
    });

    totalAmount += row.amount;
    seenContributors.add(row.handle || row.memberName || row.memberId);

    if (row.contributedAt > lastUpdatedAt) {
      lastUpdatedAt = row.contributedAt;
    }
  });

  todaysDonations.sort((a, b) => b.time.localeCompare(a.time));

  return {
    todaysDonations,
    dailyAllocationSummary: {
      totalDonations: todaysDonations.length,
      totalAmount: roundMoney(totalAmount),
      uniqueContributors: seenContributors.size,
      pending,
      lastUpdatedAt: lastUpdatedAt || easternNow().toISOString(),
    },
  };
}

function buildAllocationComparisonCurrent(
  rows: ContributionRow[],
  today: string,
  monthlyInflow: number,
): PoolInflowMetrics["allocationComparisonCurrent"] {
  const completed = rows.filter(isCountableDonation);

  const donationsOn = (ymd: string) =>
    completed.filter((row) => contributionYmd(row.contributedAt) === ymd).length;

  const todayCount = donationsOn(today);

  const weekCounts = Array.from({ length: 7 }, (_, index) => {
    const ymd = formatEasternIsoDate(subtractDays(easternNow(), 6 - index));
    return donationsOn(ymd);
  });
  const weekAverage = weekCounts.length
    ? Math.round((weekCounts.reduce((sum, count) => sum + count, 0) / weekCounts.length) * 10) / 10
    : 0;

  return {
    yesterday: todayCount,
    "last-week": weekAverage,
    "last-month": monthlyInflow,
    milestone: todayCount,
  };
}

export function computePoolInflowMetrics(today = formatEasternIsoDate()): PoolInflowMetrics {
  const contributionRows = readContributionRows();

  // Contributions are the worldwide source of truth for pool inflow.
  // Member escrow txs are a fallback when contribution rows are missing.
  let dailyInflow = 0;
  let monthlyInflow = 0;

  contributionRows.filter(isCountableDonation).forEach((row) => {
    const ymd = contributionYmd(row.contributedAt);
    if (!ymd) return;
    if (isSameMonth(ymd, today)) monthlyInflow += row.amount;
    if (ymd === today) dailyInflow += row.amount;
  });

  if (dailyInflow === 0 && monthlyInflow === 0) {
    collectMemberAccountTransactions().forEach((transaction) => {
      if (!transaction.createdAt || !isPoolInflowCredit(transaction)) return;

      const ymd = formatEasternIsoDate(transaction.createdAt);
      const amount = Number(transaction.amount);

      if (isSameMonth(ymd, today)) monthlyInflow += amount;
      if (ymd === today) dailyInflow += amount;
    });
  }

  const { todaysDonations, dailyAllocationSummary } = buildTodaysDonations(
    contributionRows,
    today,
  );

  const roundedMonthlyInflow = roundMoney(monthlyInflow);

  return {
    dailyInflow: roundMoney(dailyInflow),
    monthlyInflow: roundedMonthlyInflow,
    todaysDonations,
    dailyAllocationSummary,
    allocationComparisonCurrent: buildAllocationComparisonCurrent(
      contributionRows,
      today,
      roundedMonthlyInflow,
    ),
  };
}
