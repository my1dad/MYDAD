import type { MemberAccountTransaction } from "./memberAccounts";
import { hydrateMemberAccounts } from "./memberAccounts";
import type { RecurringCashflow, RecurringFrequency } from "./recurringCashflow";
import { getRecurringCashflows } from "./recurringCashflow";

export interface AccountsOverviewSegment {
  id: string;
  value: number;
  color: string;
}

export interface AccountsOverviewStats {
  checkingBalance: number;
  escrowBalance: number;
  totalBalance: number;
  redemptionsSent: number;
  redemptionsReceived: number;
  redemptionCount: number;
  recurringIncomeMonthly: number;
  recurringExpenseMonthly: number;
  recurringNetMonthly: number;
  recurringIncomeCount: number;
  recurringExpenseCount: number;
  recurringTransferCount: number;
  segments: AccountsOverviewSegment[];
  snapshotTotal: number;
}

const SEGMENT_COLORS = {
  checking: "#10b981",
  escrow: "#38bdf8",
  redemptionsSent: "#eab308",
  redemptionsReceived: "#f59e0b",
  recurringIncome: "#34d399",
  recurringExpense: "#f87171",
} as const;

export const ACCOUNTS_OVERVIEW_SEGMENT_IDS = [
  "checking",
  "escrow",
  "redemptionsSent",
  "redemptionsReceived",
  "recurringIncome",
  "recurringExpense",
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

function sumRecurringMonthly(schedules: RecurringCashflow[]) {
  let incomeMonthly = 0;
  let expenseMonthly = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;

  for (const schedule of schedules) {
    if (!schedule.enabled || schedule.amount <= 0) continue;

    const monthly = toMonthlyAmount(schedule.amount, schedule.frequency);

    if (schedule.type === "income") {
      incomeMonthly += monthly;
      incomeCount += 1;
    } else if (schedule.type === "expense") {
      expenseMonthly += monthly;
      expenseCount += 1;
    } else if (schedule.type === "transfer") {
      transferCount += 1;
    }
  }

  return {
    incomeMonthly,
    expenseMonthly,
    netMonthly: incomeMonthly - expenseMonthly,
    incomeCount,
    expenseCount,
    transferCount,
  };
}

export function buildAccountsOverviewStats(profileId: string): AccountsOverviewStats {
  const ledger = hydrateMemberAccounts(profileId);
  const schedules = getRecurringCashflows(profileId);
  const redemptions = sumRedemptions(ledger.transactions);
  const recurring = sumRecurringMonthly(schedules);

  const checkingBalance = ledger.checkingBalance;
  const escrowBalance = ledger.escrowBalance;
  const totalBalance = checkingBalance + escrowBalance;

  const rawSegments: AccountsOverviewSegment[] = [
    { id: "checking", value: checkingBalance, color: SEGMENT_COLORS.checking },
    { id: "escrow", value: escrowBalance, color: SEGMENT_COLORS.escrow },
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
  ];

  const segments = rawSegments.filter((segment) => segment.value > 0);
  const snapshotTotal = segments.reduce((sum, segment) => sum + segment.value, 0);

  return {
    checkingBalance,
    escrowBalance,
    totalBalance,
    redemptionsSent: redemptions.sent,
    redemptionsReceived: redemptions.received,
    redemptionCount: redemptions.count,
    recurringIncomeMonthly: recurring.incomeMonthly,
    recurringExpenseMonthly: recurring.expenseMonthly,
    recurringNetMonthly: recurring.netMonthly,
    recurringIncomeCount: recurring.incomeCount,
    recurringExpenseCount: recurring.expenseCount,
    recurringTransferCount: recurring.transferCount,
    segments,
    snapshotTotal,
  };
}
