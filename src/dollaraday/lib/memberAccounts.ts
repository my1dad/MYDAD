import { useSyncExternalStore } from "react";
import { getActiveDadProfile } from "./dadProfileStorage";
import { readDataBin, subscribeInternalDatabase, upsertDataRecord } from "./internalDatabase";
import { easternNow, formatEasternTimeWithZone, type DdaLocale } from "./dateTime";
import { getPoolState, syncMemberEscrowToLiquidityPool } from "./poolState";

export type MemberAccountId = "checking" | "escrow";
export type MemberAccountAction = "deposit" | "spend" | "transfer";

export interface MemberAccountTransaction {
  id: string;
  accountId: MemberAccountId;
  type: MemberAccountAction;
  direction: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  counterpartyAccountId?: MemberAccountId;
  memo?: string;
  createdAt: string;
}

export interface MemberAccountLedger {
  checkingBalance: number;
  escrowBalance: number;
  transactions: MemberAccountTransaction[];
}

const ledgers = new Map<string, MemberAccountLedger>();
const listeners = new Set<() => void>();

function ledgerRecordId(profileId: string): string {
  return `member-accounts-${profileId}`;
}

function createEmptyLedger(): MemberAccountLedger {
  return { checkingBalance: 0, escrowBalance: 0, transactions: [] };
}

function normalizeLedger(payload: Record<string, unknown>): MemberAccountLedger {
  const transactions = Array.isArray(payload.transactions)
    ? (payload.transactions as MemberAccountTransaction[]).map((transaction) => ({
        ...transaction,
        direction:
          transaction.direction === "credit" || transaction.direction === "debit"
            ? transaction.direction
            : transaction.type === "deposit"
              ? "credit"
              : "debit",
      }))
    : [];

  return {
    checkingBalance: Number(payload.checkingBalance) || 0,
    escrowBalance: Number(payload.escrowBalance) || 0,
    transactions,
  };
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function getBalance(ledger: MemberAccountLedger, accountId: MemberAccountId): number {
  return accountId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;
}

function setBalance(
  ledger: MemberAccountLedger,
  accountId: MemberAccountId,
  value: number,
): MemberAccountLedger {
  return accountId === "checking"
    ? { ...ledger, checkingBalance: value }
    : { ...ledger, escrowBalance: value };
}

function persistLedger(profileId: string, ledger: MemberAccountLedger): void {
  ledgers.set(profileId, ledger);
  upsertDataRecord("settings", ledgerRecordId(profileId), "member-accounts", {
    checkingBalance: ledger.checkingBalance,
    escrowBalance: ledger.escrowBalance,
    transactions: ledger.transactions,
  });
  syncMemberEscrowToLiquidityPool();
  notifyListeners();
}

export function resolveMemberProfileId(): string {
  return getActiveDadProfile()?.id ?? getPoolState().currentMember.id;
}

export function hydrateMemberAccounts(profileId: string): MemberAccountLedger {
  const cached = ledgers.get(profileId);
  if (cached) return cached;

  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === ledgerRecordId(profileId));
  const ledger = record?.payload ? normalizeLedger(record.payload) : createEmptyLedger();
  ledgers.set(profileId, ledger);
  return ledger;
}

export function invalidateMemberAccountsCache(profileId?: string): void {
  if (profileId) {
    ledgers.delete(profileId);
    return;
  }
  ledgers.clear();
}

function appendTransaction(
  ledger: MemberAccountLedger,
  transaction: Omit<MemberAccountTransaction, "id" | "createdAt">,
  createdAt?: string,
): MemberAccountLedger {
  return {
    ...ledger,
    transactions: [
      {
        ...transaction,
        id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: createdAt ?? new Date().toISOString(),
      },
      ...ledger.transactions,
    ].slice(0, 100),
  };
}

function findTransferPair(
  transactions: MemberAccountTransaction[],
  transaction: MemberAccountTransaction,
): MemberAccountTransaction | undefined {
  if (transaction.type !== "transfer") return undefined;

  return transactions.find(
    (candidate) =>
      candidate.id !== transaction.id &&
      candidate.type === "transfer" &&
      candidate.createdAt === transaction.createdAt &&
      candidate.counterpartyAccountId === transaction.accountId &&
      candidate.accountId === transaction.counterpartyAccountId,
  );
}

function recomputeLedgerBalances(
  transactions: MemberAccountTransaction[],
): MemberAccountLedger | null {
  let checkingBalance = 0;
  let escrowBalance = 0;

  const getBalance = (accountId: MemberAccountId) =>
    accountId === "checking" ? checkingBalance : escrowBalance;

  const setBalance = (accountId: MemberAccountId, value: number) => {
    if (accountId === "checking") checkingBalance = value;
    else escrowBalance = value;
  };

  const chronological = [...transactions].sort((a, b) => {
    const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  const balanceAfterById = new Map<string, number>();

  for (const transaction of chronological) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const nextBalance =
      transaction.direction === "credit"
        ? getBalance(transaction.accountId) + amount
        : getBalance(transaction.accountId) - amount;

    if (nextBalance < 0) return null;

    setBalance(transaction.accountId, nextBalance);
    balanceAfterById.set(transaction.id, nextBalance);
  }

  const updatedTransactions = transactions.map((transaction) => ({
    ...transaction,
    balanceAfter: balanceAfterById.get(transaction.id) ?? transaction.balanceAfter,
  }));

  return {
    checkingBalance,
    escrowBalance,
    transactions: updatedTransactions,
  };
}

function applyRecomputedLedger(ledger: MemberAccountLedger): MemberAccountLedger | null {
  return recomputeLedgerBalances(ledger.transactions);
}

function applyLedgerMutation(
  profileId: string,
  mutate: (ledger: MemberAccountLedger) => MemberAccountLedger,
): MemberAccountLedger | null {
  const current = hydrateMemberAccounts(profileId);
  const next = mutate(current);
  if (next === current) return null;
  persistLedger(profileId, next);
  return next;
}

function collectLinkedTransactionIds(
  transactions: MemberAccountTransaction[],
  transaction: MemberAccountTransaction,
): Set<string> {
  const ids = new Set<string>([transaction.id]);
  const pair = findTransferPair(transactions, transaction);
  if (pair) ids.add(pair.id);
  return ids;
}

export function deleteMemberAccountTransaction(
  profileId: string,
  transactionId: string,
): MemberAccountLedger | null {
  return applyLedgerMutation(profileId, (ledger) => {
    const target = ledger.transactions.find((transaction) => transaction.id === transactionId);
    if (!target) return ledger;

    const removeIds = collectLinkedTransactionIds(ledger.transactions, target);
    const remaining = ledger.transactions.filter((transaction) => !removeIds.has(transaction.id));
    const recomputed = applyRecomputedLedger({ ...ledger, transactions: remaining });
    return recomputed ?? ledger;
  });
}

export function updateMemberAccountTransaction(
  profileId: string,
  transactionId: string,
  updates: { amount?: number; memo?: string },
): MemberAccountLedger | null {
  const nextAmount = updates.amount;
  if (nextAmount !== undefined && (!Number.isFinite(nextAmount) || nextAmount <= 0)) {
    return null;
  }

  const nextMemo = updates.memo !== undefined ? updates.memo.trim() || undefined : undefined;

  return applyLedgerMutation(profileId, (ledger) => {
    const target = ledger.transactions.find((transaction) => transaction.id === transactionId);
    if (!target) return ledger;

    const linkedIds = collectLinkedTransactionIds(ledger.transactions, target);
    const updatedTransactions = ledger.transactions.map((transaction) => {
      if (!linkedIds.has(transaction.id)) return transaction;

      return {
        ...transaction,
        amount: nextAmount ?? transaction.amount,
        memo: updates.memo !== undefined ? nextMemo : transaction.memo,
      };
    });

    const recomputed = applyRecomputedLedger({ ...ledger, transactions: updatedTransactions });
    return recomputed ?? ledger;
  });
}

export function depositToMemberAccount(
  profileId: string,
  accountId: MemberAccountId,
  amount: number,
  memo?: string,
  options?: { occurredAt?: string },
): MemberAccountLedger | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return applyLedgerMutation(profileId, (ledger) => {
    const balance = getBalance(ledger, accountId) + amount;
    const withBalance = setBalance(ledger, accountId, balance);
    return appendTransaction(
      withBalance,
      {
        accountId,
        type: "deposit",
        direction: "credit",
        amount,
        balanceAfter: balance,
        memo: memo?.trim() || undefined,
      },
      options?.occurredAt,
    );
  });
}

export function spendFromMemberAccount(
  profileId: string,
  accountId: MemberAccountId,
  amount: number,
  memo?: string,
  options?: { occurredAt?: string },
): MemberAccountLedger | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return applyLedgerMutation(profileId, (ledger) => {
    const current = getBalance(ledger, accountId);
    if (amount > current) return ledger;

    const balance = current - amount;
    const withBalance = setBalance(ledger, accountId, balance);
    return appendTransaction(
      withBalance,
      {
        accountId,
        type: "spend",
        direction: "debit",
        amount,
        balanceAfter: balance,
        memo: memo?.trim() || undefined,
      },
      options?.occurredAt,
    );
  });
}

export function transferBetweenMemberAccounts(
  profileId: string,
  fromAccountId: MemberAccountId,
  toAccountId: MemberAccountId,
  amount: number,
  memo?: string,
  options?: { occurredAt?: string },
): MemberAccountLedger | null {
  if (fromAccountId === toAccountId) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return applyLedgerMutation(profileId, (ledger) => {
    const fromBalance = getBalance(ledger, fromAccountId);
    if (amount > fromBalance) return ledger;

    const toBalance = getBalance(ledger, toAccountId) + amount;
    let next = setBalance(ledger, fromAccountId, fromBalance - amount);
    next = setBalance(next, toAccountId, toBalance);

    const note = memo?.trim() || undefined;
    const occurredAt = options?.occurredAt;
    next = appendTransaction(
      next,
      {
        accountId: fromAccountId,
        type: "transfer",
        direction: "debit",
        amount,
        balanceAfter: fromBalance - amount,
        counterpartyAccountId: toAccountId,
        memo: note,
      },
      occurredAt,
    );
    return appendTransaction(
      next,
      {
        accountId: toAccountId,
        type: "transfer",
        direction: "credit",
        amount,
        balanceAfter: toBalance,
        counterpartyAccountId: fromAccountId,
        memo: note,
      },
      occurredAt,
    );
  });
}

export function redeemToMemberProfile(
  fromProfileId: string,
  toProfileId: string,
  amount: number,
  memo?: string,
): boolean {
  if (fromProfileId === toProfileId) return false;
  if (!Number.isFinite(amount) || amount <= 0) return false;

  const senderLedger = hydrateMemberAccounts(fromProfileId);
  if (amount > senderLedger.checkingBalance) return false;

  const note = memo?.trim() || undefined;
  const spent = spendFromMemberAccount(fromProfileId, "checking", amount, note);
  if (!spent) return false;

  const deposited = depositToMemberAccount(toProfileId, "checking", amount, note);
  if (!deposited) {
    depositToMemberAccount(fromProfileId, "checking", amount, "Redemption reversal");
    return false;
  }

  return true;
}

export function getMemberAccountLedger(profileId = resolveMemberProfileId()): MemberAccountLedger {
  return hydrateMemberAccounts(profileId);
}

export function subscribeMemberAccounts(listener: () => void): () => void {
  listeners.add(listener);
  const unsubscribeDb = subscribeInternalDatabase(listener);
  return () => {
    listeners.delete(listener);
    unsubscribeDb();
  };
}

export function useMemberAccounts(profileId = resolveMemberProfileId()): MemberAccountLedger {
  return useSyncExternalStore(
    subscribeMemberAccounts,
    () => hydrateMemberAccounts(profileId),
    () => hydrateMemberAccounts(profileId),
  );
}

export function formatAccountTransactionTime(iso: string, locale: DdaLocale = "en"): string {
  try {
    return formatEasternTimeWithZone(new Date(iso), locale);
  } catch {
    return formatEasternTimeWithZone(easternNow(), locale);
  }
}

export function maskAccountNumber(profileId: string, accountId: MemberAccountId): string {
  const seed = profileId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const suffix = accountId === "checking" ? (seed % 9000) + 1000 : ((seed * 7) % 9000) + 1000;
  return `•••• •••• •••• ${suffix}`;
}
