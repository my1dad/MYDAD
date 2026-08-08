import type { MemberAccountTransaction } from "./memberAccounts";
import { hydrateMemberAccounts } from "./memberAccounts";
import { readDataBin } from "./internalDatabase";
import { getPlatformMemberDonationTotals } from "./memberContributionStats";
import {
  getCompletedContributionCapital,
  getTotalAdminFundedMemberCapital,
  getTotalMemberDepositCapitalFromLedgers,
} from "./memberEscrowTotals";
import type { RecurringCashflow, RecurringFrequency } from "./recurringCashflow";
import { getRecurringCashflows, isHomeContributionSchedule } from "./recurringCashflow";

export interface AccountsOverviewSegment {
  id: string;
  value: number;
  color: string;
}

export interface AccountsOverviewStats {
  checkingBalance: number;
  escrowBalance: number;
  totalBalance: number;
  depositsTotal: number;
  depositsCount: number;
  redemptionsSent: number;
  redemptionsReceived: number;
  redemptionCount: number;
  recurringIncomeMonthly: number;
  recurringExpenseMonthly: number;
  recurringTransferMonthly: number;
  recurringNetMonthly: number;
  recurringIncomeCount: number;
  recurringExpenseCount: number;
  recurringTransferCount: number;
  recurringPaymentLabels: string[];
  segments: AccountsOverviewSegment[];
  snapshotTotal: number;
}

const SEGMENT_COLORS = {
  checking: "var(--color-dda-green)",
  escrow: "#38bdf8",
  deposits: "var(--color-dda-gold-light)",
  redemptionsSent: "var(--color-dda-gold)",
  redemptionsReceived: "var(--color-dda-gold-deep)",
  recurringIncome: "#fb7185",
  recurringExpense: "#f87171",
  recurringTransfer: "#a78bfa",
} as const;

export const ACCOUNTS_OVERVIEW_SEGMENT_IDS = [
  "checking",
  "escrow",
  "deposits",
  "redemptionsSent",
  "redemptionsReceived",
  "recurringIncome",
  "recurringExpense",
  "recurringTransfer",
] as const;

export type AccountsOverviewSegmentId = (typeof ACCOUNTS_OVERVIEW_SEGMENT_IDS)[number];

function isRedemptionMemo(memo?: string): boolean {
  if (!memo) return false;
  const lower = memo.toLowerCase();
  return lower.includes("redemption") || lower.includes("redención");
}

function toMonthlyAmount(amount: number, frequency: RecurringFrequency): number {
  switch (frequency) {
    case "daily":
      return amount * 30;
    case "weekly":
      return (amount * 52) / 12;
    case "biweekly":
      return (amount * 26) / 12;
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    default:
      return amount;
  }
}

function normalizeDonationFrequency(raw: unknown): RecurringFrequency {
  if (
    raw === "daily" ||
    raw === "weekly" ||
    raw === "biweekly" ||
    raw === "monthly" ||
    raw === "yearly"
  ) {
    return raw;
  }
  return "monthly";
}

/**
 * Sum every user-started recurring donation as a monthly equivalent.
 * Weekly ($7) → ~$30.33/mo, monthly stays as-is, etc.
 */
function sumRecurringDonationsFromContributions(profileId: string) {
  let monthly = 0;
  let count = 0;

  readDataBin("contributions").records.forEach((record) => {
    if (record.source === "recurring-home-contribution" || record.source === "recurring-automation") {
      return;
    }
    const payload = record.payload ?? {};
    if (payload.automated) return;
    if (!payload.recurringEnabled) return;

    const owner = String(payload.profileId ?? payload.memberId ?? "").trim();
    if (owner !== profileId) return;

    const type = String(payload.type ?? "");
    if (type === "wallet-deposit" || type === "signup" || type === "one-time") return;
    if (record.source !== "contribute-onboarding" && type !== "recurring") return;

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (String(payload.status ?? "completed") !== "completed") return;

    monthly += toMonthlyAmount(amount, normalizeDonationFrequency(payload.frequency));
    count += 1;
  });

  return { monthly: roundMoney(monthly), count };
}

function sumRedemptions(transactions: MemberAccountTransaction[]) {
  let sent = 0;
  let received = 0;
  let count = 0;

  for (const transaction of transactions) {
    if (!isRedemptionMemo(transaction.memo)) continue;

    if (
      transaction.accountId === "checking" &&
      (transaction.type === "spend" || transaction.direction === "debit")
    ) {
      sent += transaction.amount;
      count += 1;
      continue;
    }

    if (
      transaction.accountId === "checking" &&
      (transaction.type === "deposit" || transaction.direction === "credit")
    ) {
      received += transaction.amount;
      count += 1;
    }
  }

  return { sent, received, count };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumDeposits(profileId: string) {
  let total = 0;
  let count = 0;

  readDataBin("contributions").records.forEach((record) => {
    const payload = record.payload ?? {};
    const owner = String(payload.profileId ?? payload.memberId ?? "").trim();
    if (owner !== profileId) return;

    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (String(payload.type ?? "") === "signup") return;
    if (String(payload.status ?? "completed") !== "completed") return;

    total += amount;
    count += 1;
  });

  return { total: roundMoney(total), count };
}

function sumRecurringMonthly(
  schedules: RecurringCashflow[],
  donationSeeds: { monthly: number; count: number },
) {
  let incomeMonthly = 0;
  let expenseMonthly = 0;
  let transferMonthly = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;
  const paymentLabels: string[] = [];

  // Prefer contribution seeds for donations so every recurring gift is counted
  // (weekly normalized to monthly), even before schedule rebuild catches up.
  let donationScheduleMonthly = 0;
  let donationScheduleCount = 0;

  for (const schedule of schedules) {
    if (!schedule.enabled || schedule.amount <= 0) continue;

    const monthly = toMonthlyAmount(schedule.amount, schedule.frequency);

    if (isHomeContributionSchedule(schedule)) {
      donationScheduleMonthly += monthly;
      donationScheduleCount += 1;
      continue;
    }

    if (schedule.type === "income") {
      incomeMonthly += monthly;
      incomeCount += 1;
    } else if (schedule.type === "expense") {
      expenseMonthly += monthly;
      expenseCount += 1;
    } else if (schedule.type === "transfer") {
      transferCount += 1;
      transferMonthly += monthly;
      const label = schedule.label?.trim() || "Recurring payment";
      if (!paymentLabels.includes(label)) paymentLabels.push(label);
    }
  }

  const donationMonthly =
    donationSeeds.count > 0 ? donationSeeds.monthly : roundMoney(donationScheduleMonthly);
  const donationCount =
    donationSeeds.count > 0 ? donationSeeds.count : donationScheduleCount;

  const incomeRounded = roundMoney(incomeMonthly + donationMonthly);
  const expenseRounded = roundMoney(expenseMonthly);
  incomeCount += donationCount;

  return {
    incomeMonthly: incomeRounded,
    expenseMonthly: expenseRounded,
    transferMonthly: roundMoney(transferMonthly),
    netMonthly: roundMoney(incomeRounded - expenseRounded),
    incomeCount,
    expenseCount,
    transferCount,
    paymentLabels,
  };
}

export function buildAccountsOverviewStats(
  profileId: string,
  options: { platformScope?: boolean } = {},
): AccountsOverviewStats {
  const ledger = hydrateMemberAccounts(profileId);
  const schedules = getRecurringCashflows(profileId);
  const personalDeposits = sumDeposits(profileId);
  const platformDonations = options.platformScope
    ? getPlatformMemberDonationTotals()
    : null;
  // Admin Accounts: sum member deposits (admin-funded checking/equity + ledgers + contributions).
  const deposits = options.platformScope
    ? (() => {
        const total = Math.max(
          getTotalMemberDepositCapitalFromLedgers(),
          getTotalAdminFundedMemberCapital(),
          getCompletedContributionCapital(),
          platformDonations?.donated ?? 0,
        );
        const fundedMembers = readDataBin("members").records.filter(
          (record) =>
            record.payload?.adminBalancesLocked === true &&
            (Number(record.payload?.equity) > 0 || Number(record.payload?.contributed) > 0),
        ).length;
        const count = Math.max(fundedMembers, platformDonations?.count ?? 0);
        return { total, count };
      })()
    : personalDeposits;
  const redemptions = sumRedemptions(ledger.transactions);
  const donationSeeds = sumRecurringDonationsFromContributions(profileId);
  const recurring = sumRecurringMonthly(schedules, donationSeeds);

  const checkingBalance = ledger.checkingBalance;
  const escrowBalance = ledger.escrowBalance;
  const totalBalance = checkingBalance + escrowBalance;

  const rawSegments: AccountsOverviewSegment[] = [
    { id: "checking", value: checkingBalance, color: SEGMENT_COLORS.checking },
    { id: "escrow", value: escrowBalance, color: SEGMENT_COLORS.escrow },
    { id: "deposits", value: deposits.total, color: SEGMENT_COLORS.deposits },
    {
      id: "redemptionsSent",
      value: redemptions.sent,
      color: SEGMENT_COLORS.redemptionsSent,
    },
    {
      id: "redemptionsReceived",
      value: redemptions.received,
      color: SEGMENT_COLORS.redemptionsReceived,
    },
    {
      id: "recurringIncome",
      value: recurring.incomeMonthly,
      color: SEGMENT_COLORS.recurringIncome,
    },
    {
      id: "recurringExpense",
      value: recurring.expenseMonthly,
      color: SEGMENT_COLORS.recurringExpense,
    },
    {
      id: "recurringTransfer",
      value: recurring.transferMonthly,
      color: SEGMENT_COLORS.recurringTransfer,
    },
  ];

  const segments = rawSegments.filter((segment) => segment.value > 0);
  const snapshotTotal = segments.reduce((sum, segment) => sum + segment.value, 0);

  return {
    checkingBalance,
    escrowBalance,
    totalBalance,
    depositsTotal: deposits.total,
    depositsCount: deposits.count,
    redemptionsSent: redemptions.sent,
    redemptionsReceived: redemptions.received,
    redemptionCount: redemptions.count,
    recurringIncomeMonthly: recurring.incomeMonthly,
    recurringExpenseMonthly: recurring.expenseMonthly,
    recurringTransferMonthly: recurring.transferMonthly,
    recurringNetMonthly: recurring.netMonthly,
    recurringIncomeCount: recurring.incomeCount,
    recurringExpenseCount: recurring.expenseCount,
    recurringTransferCount: recurring.transferCount,
    recurringPaymentLabels: recurring.paymentLabels,
    segments,
    snapshotTotal,
  };
}
