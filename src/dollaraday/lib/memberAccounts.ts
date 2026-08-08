import { useSyncExternalStore } from "react";
import { ADMIN_USERNAME } from "../../config/admin";
import {
  findDadProfileByUsername,
  formatMaskedAccountNumber,
  getActiveDadProfile,
  getProfileAccountNumber,
} from "./dadProfileStorage";
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
const ledgerCacheMeta = new Map<string, string>();
const listeners = new Set<() => void>();

function ledgerRecordId(profileId: string): string {
  return `member-accounts-${profileId}`;
}

function createEmptyLedger(): MemberAccountLedger {
  return { checkingBalance: 0, escrowBalance: 0, transactions: [] };
}

function ledgerFingerprint(
  settingsUpdatedAt: string,
  record: { updatedAt?: string; payload?: Record<string, unknown> } | undefined,
): string {
  const payload = record?.payload;
  const transactions = Array.isArray(payload?.transactions) ? payload.transactions : [];
  const head = transactions[0] as { id?: string; amount?: number } | undefined;
  const tail = transactions[transactions.length - 1] as { id?: string; amount?: number } | undefined;
  return [
    settingsUpdatedAt,
    record?.updatedAt ?? "",
    Number(payload?.checkingBalance) || 0,
    Number(payload?.escrowBalance) || 0,
    transactions.length,
    head?.id ?? "",
    head?.amount ?? "",
    tail?.id ?? "",
    tail?.amount ?? "",
  ].join("|");
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
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === ledgerRecordId(profileId));
  ledgerCacheMeta.set(profileId, ledgerFingerprint(settings.updatedAt, record));
  syncMemberEscrowToLiquidityPool();
  notifyListeners();
}

export function resolveMemberProfileId(): string {
  return getActiveDadProfile()?.id ?? getPoolState().currentMember.id;
}

export function hydrateMemberAccounts(profileId: string): MemberAccountLedger {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === ledgerRecordId(profileId));
  const fingerprint = ledgerFingerprint(settings.updatedAt, record);
  const cached = ledgers.get(profileId);
  if (cached && ledgerCacheMeta.get(profileId) === fingerprint) {
    return cached;
  }

  const ledger = record?.payload ? normalizeLedger(record.payload) : createEmptyLedger();
  ledgers.set(profileId, ledger);
  ledgerCacheMeta.set(profileId, fingerprint);
  return ledger;
}

export function invalidateMemberAccountsCache(profileId?: string): void {
  if (profileId) {
    ledgers.delete(profileId);
    ledgerCacheMeta.delete(profileId);
  } else {
    ledgers.clear();
    ledgerCacheMeta.clear();
  }
  notifyListeners();
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

/** Master admin profile id — Chase Escrow sink for member donations. */
export function getAdminProfileId(): string | undefined {
  return findDadProfileByUsername(ADMIN_USERNAME)?.id;
}

/** Resolve the platform Chase Escrow owner (master admin), with safe fallback. */
export function resolvePlatformEscrowProfileId(fallbackProfileId?: string): string {
  return getAdminProfileId() || fallbackProfileId || resolveMemberProfileId();
}

/**
 * Credit master admin Chase Escrow for a member donation (instant / weekly / monthly).
 * Donor attribution stays on the contribution record; cash settles on admin escrow.
 */
export function depositDonationToPlatformEscrow(
  amount: number,
  memo: string,
  options?: { occurredAt?: string; donorProfileId?: string },
): MemberAccountLedger | null {
  const platformId = resolvePlatformEscrowProfileId(options?.donorProfileId);
  return depositToMemberAccount(platformId, "escrow", amount, memo, options);
}

/** Member-facing wallet = checking + escrow (escrow holds pool contributions). */
export function getMemberWalletBalance(ledger: MemberAccountLedger): number {
  return (Number(ledger.checkingBalance) || 0) + (Number(ledger.escrowBalance) || 0);
}

export function isInternalWalletTransfer(transaction: MemberAccountTransaction): boolean {
  if (transaction.type !== "transfer") return false;
  const counterparty = transaction.counterpartyAccountId;
  return (
    (transaction.accountId === "checking" && counterparty === "escrow") ||
    (transaction.accountId === "escrow" && counterparty === "checking")
  );
}

/** Credits member wallet — funds land in escrow (liquidity pool cash). */
export function depositToMemberWallet(
  profileId: string,
  amount: number,
  memo?: string,
  options?: { occurredAt?: string },
): MemberAccountLedger | null {
  return depositToMemberAccount(profileId, "escrow", amount, memo, options);
}

/** Debits member wallet — prefers escrow, then checking. */
export function spendFromMemberWallet(
  profileId: string,
  amount: number,
  memo?: string,
  options?: { occurredAt?: string },
): MemberAccountLedger | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return applyLedgerMutation(profileId, (ledger) => {
    if (amount > getMemberWalletBalance(ledger)) return ledger;

    const note = memo?.trim() || undefined;
    const occurredAt = options?.occurredAt;
    let remaining = amount;
    let next = ledger;

    const takeFrom = (accountId: MemberAccountId) => {
      if (remaining <= 0) return;
      const available = getBalance(next, accountId);
      if (available <= 0) return;
      const take = Math.min(remaining, available);
      const balance = available - take;
      next = setBalance(next, accountId, balance);
      next = appendTransaction(
        next,
        {
          accountId,
          type: "spend",
          direction: "debit",
          amount: take,
          balanceAfter: balance,
          memo: note,
        },
        occurredAt,
      );
      remaining -= take;
    };

    takeFrom("escrow");
    takeFrom("checking");
    return remaining > 0 ? ledger : next;
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
  options: { allowLiquidityPool?: boolean; liquidityAvailable?: number } = {},
): boolean {
  if (fromProfileId === toProfileId) return false;
  if (!Number.isFinite(amount) || amount <= 0) return false;

  const senderLedger = hydrateMemberAccounts(fromProfileId);
  const walletAvailable =
    (Number(senderLedger.checkingBalance) || 0) + (Number(senderLedger.escrowBalance) || 0);
  const poolAvailable = Math.max(0, Number(options.liquidityAvailable) || 0);
  const available = options.allowLiquidityPool
    ? Math.max(walletAvailable, poolAvailable)
    : walletAvailable;
  if (amount > available) return false;

  const note = memo?.trim() || undefined;
  let remaining = Math.round(amount * 100) / 100;

  // Spend checking first, then escrow (liquidity).
  if (remaining > 0 && senderLedger.checkingBalance > 0) {
    const take = Math.min(remaining, senderLedger.checkingBalance);
    if (!spendFromMemberAccount(fromProfileId, "checking", take, note)) return false;
    remaining = Math.round((remaining - take) * 100) / 100;
  }
  if (remaining > 0) {
    const fresh = hydrateMemberAccounts(fromProfileId);
    if (fresh.escrowBalance > 0) {
      const take = Math.min(remaining, fresh.escrowBalance);
      if (!spendFromMemberAccount(fromProfileId, "escrow", take, note)) {
        if (amount - remaining > 0) {
          depositToMemberAccount(fromProfileId, "checking", amount - remaining, "Redemption reversal");
        }
        return false;
      }
      remaining = Math.round((remaining - take) * 100) / 100;
    }
  }

  // Non-admin transfers must fully debit the sender wallet.
  if (remaining > 0 && !options.allowLiquidityPool) {
    const spent = Math.round((amount - remaining) * 100) / 100;
    if (spent > 0) {
      depositToMemberAccount(fromProfileId, "checking", spent, "Redemption reversal");
    }
    return false;
  }

  // Admin liquidity transfer: credit recipient even when sender wallet was empty
  // (funds are allocated from community liquidity totals).
  const deposited = depositToMemberAccount(toProfileId, "checking", amount, note);
  if (!deposited) {
    depositToMemberAccount(fromProfileId, "checking", amount - remaining, "Redemption reversal");
    return false;
  }

  // Mirror into recipient escrow so pool/member balances stay aligned.
  const recipient = hydrateMemberAccounts(toProfileId);
  persistLedger(toProfileId, {
    ...recipient,
    escrowBalance: Math.max(recipient.escrowBalance, recipient.checkingBalance),
  });

  return true;
}

export function getMemberAccountLedger(profileId = resolveMemberProfileId()): MemberAccountLedger {
  return hydrateMemberAccounts(profileId);
}

/** Admin override: set checking / escrow wallet balances for a member. */
export function adminSetMemberWalletBalances(
  profileId: string,
  balances: { checking: number; escrow?: number },
): MemberAccountLedger {
  if (!profileId) {
    throw new Error("profileId is required");
  }
  const ledger = hydrateMemberAccounts(profileId);
  const checking = Math.max(0, Math.round((Number(balances.checking) || 0) * 100) / 100);
  // Admin-funded deposits are community liquidity — mirror into escrow so the
  // pool widget totals update immediately (pool cash is escrow-driven).
  const escrow =
    balances.escrow === undefined
      ? checking
      : Math.max(0, Math.round((Number(balances.escrow) || 0) * 100) / 100);
  const next: MemberAccountLedger = {
    ...ledger,
    checkingBalance: checking,
    escrowBalance: escrow,
  };
  persistLedger(profileId, next);
  return next;
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

export function maskAccountNumber(profileId: string, _accountId?: MemberAccountId): string {
  const accountNumber = getProfileAccountNumber(profileId);
  if (accountNumber) return formatMaskedAccountNumber(accountNumber);

  // Legacy fallback for profiles mid-migration.
  const seed = profileId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const suffix = ((seed % 9000) + 1000).toString();
  return `•••• •••• •••• ${suffix}`;
}
