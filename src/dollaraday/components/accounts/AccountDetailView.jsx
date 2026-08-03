import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  HeartHandshake,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import PlatformEquityCard from "../home/PlatformEquityCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import {
  deleteMemberAccountTransaction,
  depositToMemberAccount,
  formatAccountTransactionTime,
  getMemberWalletBalance,
  isInternalWalletTransfer,
  maskAccountNumber,
  resolveMemberProfileId,
  spendFromMemberAccount,
  spendFromMemberWallet,
  transferBetweenMemberAccounts,
  updateMemberAccountTransaction,
  useMemberAccounts,
} from "../../lib/memberAccounts";
import { buildMemberWalletActivity } from "../../lib/memberContributionStats";
import { ensureProfileEscrowFromContributions } from "../../lib/poolEscrowReconcile";
import { usePoolState } from "../../lib/poolState";
import { playCashSound, preloadCashSound } from "../../lib/playCashSound";
import { saveContribution, saveWalletDeposit } from "../../lib/storageWrites";
import RecurringCashflowPanel from "./RecurringCashflowPanel";
import WalletFundingTabs from "./WalletFundingTabs";
import BankAccountLogo from "./BankAccountLogo";
import { getAccountDisplay } from "./accountDisplay";
import { MEMBER_BANK_ACCOUNTS } from "./bankAccounts";

const ContributeOnboardingModal = lazy(() => import("../onboarding/ContributeOnboardingModal"));

const ACCOUNT_META = MEMBER_BANK_ACCOUNTS;

const ACTION_OPTIONS = [
  { id: "deposit", icon: ArrowDownLeft, labelKey: "actionDeposit" },
  { id: "transfer", icon: ArrowLeftRight, labelKey: "actionTransfer" },
  { id: "spend", icon: ArrowUpRight, labelKey: "actionSpend" },
];

const MEMBER_ACTION_OPTIONS = [
  { id: "deposit", icon: ArrowDownLeft, labelKey: "actionDeposit" },
  { id: "donate", icon: HeartHandshake, labelKey: "actionDonate" },
];

function sanitizeMoneyInput(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function formatMoneyInput(value) {
  const sanitized = sanitizeMoneyInput(value);
  if (!sanitized) return "";

  const [wholePart, decimalPart] = sanitized.split(".");
  const wholeNumber = wholePart ? Number(wholePart) : 0;
  const formattedWhole = wholeNumber.toLocaleString("en-US");

  if (sanitized.endsWith(".")) {
    return `$${formattedWhole}.`;
  }
  if (decimalPart !== undefined) {
    return `$${formattedWhole}.${decimalPart}`;
  }
  return `$${formattedWhole}`;
}

function parseAmount(value) {
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function handleAmountChange(value, setAmount) {
  const stripped = String(value).replace(/[$,\s]/g, "");
  if (!stripped) {
    setAmount("");
    return;
  }
  setAmount(formatMoneyInput(stripped));
}

const ACTIVITY_PAGE_SIZE = 10;

function getTransactionTitle(transaction, t) {
  if (transaction.type === "deposit") return t("pages.accounts.txDeposit");
  if (transaction.type === "donation") return t("pages.accounts.txDonation");
  if (transaction.type === "recurring") {
    const frequency = String(transaction.frequency ?? "");
    if (frequency === "weekly") return t("pages.accounts.txRecurringWeekly");
    if (frequency === "monthly") return t("pages.accounts.txRecurringMonthly");
    return t("pages.accounts.txRecurringDonation");
  }
  if (transaction.type === "spend") return t("pages.accounts.txSpend");
  if (transaction.counterpartyAccountId) {
    const meta = ACCOUNT_META[transaction.counterpartyAccountId];
    return t("pages.accounts.txTransferWith", {
      account: t(`pages.accounts.${meta.labelKey}`),
    });
  }
  return t("pages.accounts.txTransfer");
}

function ActivityIcon({ type }) {
  if (type === "deposit") {
    return <ArrowDownLeft className="h-4 w-4 text-dda-green-light" />;
  }
  if (type === "donation" || type === "recurring") {
    return <HeartHandshake className="h-4 w-4 text-rose-300" />;
  }
  if (type === "spend") {
    return <ArrowUpRight className="h-4 w-4 text-red-400" />;
  }
  return <ArrowLeftRight className="h-4 w-4 text-sky-300" />;
}

function getSignedAmount(transaction) {
  return transaction.direction === "credit" ? transaction.amount : -transaction.amount;
}

export default function AccountDetailView({
  accountId,
  onBack,
  presentation = "page",
  onCreditAdded,
}) {
  const { t, locale } = useLocale();
  const { isAdmin } = useDadAuth();
  const { currentMember } = usePoolState();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const meta = ACCOUNT_META[accountId];
  const accountDisplay = getAccountDisplay(accountId, isAdmin, t);
  const counterpartyId = accountId === "checking" ? "escrow" : "checking";
  const unifiedWallet = !isAdmin && accountId === "checking";
  const isOverlay = presentation === "overlay";

  const [activeAction, setActiveAction] = useState("deposit");
  const [transferFromId, setTransferFromId] = useState(accountId);
  const [transferToId, setTransferToId] = useState(counterpartyId);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [activityPage, setActivityPage] = useState(0);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMemo, setEditMemo] = useState("");
  const [activityActionError, setActivityActionError] = useState("");
  const [donateOpen, setDonateOpen] = useState(false);
  const [donationReceipt, setDonationReceipt] = useState(null);

  const actionOptions = isAdmin ? ACTION_OPTIONS : MEMBER_ACTION_OPTIONS;

  useEffect(() => {
    if (accountId === "escrow" || unifiedWallet) {
      ensureProfileEscrowFromContributions(profileId);
    }
  }, [accountId, profileId, unifiedWallet]);

  useEffect(() => {
    preloadCashSound();
  }, []);

  useEffect(() => {
    setTransferFromId(accountId);
    setTransferToId(counterpartyId);
    setActivityPage(0);
    setEditingTransactionId(null);
    setActivityActionError("");
    setActiveAction("deposit");
  }, [accountId, counterpartyId]);

  const balance = unifiedWallet
    ? getMemberWalletBalance(ledger)
    : accountId === "checking"
      ? ledger.checkingBalance
      : ledger.escrowBalance;
  const transferFromMeta = ACCOUNT_META[transferFromId];
  const transferToMeta = ACCOUNT_META[transferToId];
  const transferFromBalance =
    transferFromId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;
  const transferToBalance =
    transferToId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;

  const accountTransactions = useMemo(() => {
    if (unifiedWallet) {
      const ledgerRows = ledger.transactions.filter((item) => !isInternalWalletTransfer(item));
      return buildMemberWalletActivity(profileId, ledgerRows);
    }
    return ledger.transactions
      .filter((item) => item.accountId === accountId)
      .map((item) => ({ ...item, source: "ledger" }));
  }, [ledger.transactions, accountId, unifiedWallet, profileId]);

  const totalActivityPages = Math.max(1, Math.ceil(accountTransactions.length / ACTIVITY_PAGE_SIZE));

  useEffect(() => {
    if (activityPage > totalActivityPages - 1) {
      setActivityPage(Math.max(0, totalActivityPages - 1));
    }
  }, [activityPage, totalActivityPages]);

  const pagedTransactions = useMemo(() => {
    const start = activityPage * ACTIVITY_PAGE_SIZE;
    return accountTransactions.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [accountTransactions, activityPage]);

  const parsedAmount = parseAmount(amount);

  const handleSwapTransferAccounts = () => {
    setTransferFromId(transferToId);
    setTransferToId(transferFromId);
    setError("");
  };

  const cancelEditTransaction = () => {
    setEditingTransactionId(null);
    setEditAmount("");
    setEditMemo("");
    setActivityActionError("");
  };

  const startEditTransaction = (transaction) => {
    setEditingTransactionId(transaction.id);
    setEditAmount(formatMoneyInput(String(transaction.amount)));
    setEditMemo(transaction.memo ?? "");
    setActivityActionError("");
  };

  const saveEditTransaction = () => {
    const parsed = parseAmount(editAmount);
    if (parsed <= 0) {
      setActivityActionError(t("pages.accounts.amountRequired"));
      return;
    }

    const result = updateMemberAccountTransaction(profileId, editingTransactionId, {
      amount: parsed,
      memo: editMemo,
    });

    if (!result) {
      setActivityActionError(t("pages.accounts.editFailed"));
      return;
    }

    cancelEditTransaction();
  };

  const handleDeleteTransaction = (transactionId) => {
    if (!window.confirm(t("pages.accounts.confirmDeleteTransaction"))) return;

    const result = deleteMemberAccountTransaction(profileId, transactionId);
    if (!result) {
      setActivityActionError(t("pages.accounts.deleteFailed"));
      return;
    }

    if (editingTransactionId === transactionId) {
      cancelEditTransaction();
    }
    setActivityActionError("");
  };

  const clearFundFeedback = () => {
    setError("");
    setStatus("");
  };

  const handleDepositAmount = () => {
    clearFundFeedback();
    setDonationReceipt(null);

    if (parsedAmount <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }

    const result = unifiedWallet
      ? saveWalletDeposit({ amount: parsedAmount, memo })
      : depositToMemberAccount(profileId, accountId, parsedAmount, memo);

    if (!result) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }

    playCashSound();
    onCreditAdded?.(parsedAmount);
    setAmount("");
    setMemo("");
    setActivityPage(0);
    setStatus(t("pages.accounts.transactionSuccess"));
  };

  const handleDonateAmount = () => {
    clearFundFeedback();
    if (parsedAmount <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }
    setActiveAction("donate");
    setDonateOpen(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    if (parsedAmount <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }

    let result = null;
    if (activeAction === "deposit") {
      result = unifiedWallet
        ? saveWalletDeposit({ amount: parsedAmount, memo })
        : depositToMemberAccount(profileId, accountId, parsedAmount, memo);
    } else if (activeAction === "spend") {
      result = unifiedWallet
        ? spendFromMemberWallet(profileId, parsedAmount, memo)
        : spendFromMemberAccount(profileId, accountId, parsedAmount, memo);
      if (!result) setError(t("pages.accounts.insufficientFunds"));
    } else {
      result = transferBetweenMemberAccounts(
        profileId,
        transferFromId,
        transferToId,
        parsedAmount,
        memo,
      );
      if (!result) setError(t("pages.accounts.insufficientFunds"));
    }

    if (result) {
      if (activeAction === "deposit") {
        playCashSound();
        onCreditAdded?.(parsedAmount);
      }
      setAmount("");
      setMemo("");
      setActivityPage(0);
      setStatus(t("pages.accounts.transactionSuccess"));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {!isOverlay ? (
        <button
          type="button"
          onClick={onBack}
          className="dda-accounts-back inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t(isAdmin ? "pages.accounts.backToAccounts" : "pages.wallet.backToWallet")}
        </button>
      ) : null}

      {isOverlay ? null : unifiedWallet ? (
        <PlatformEquityCard wallet />
      ) : (
        <section className="dda-bank-hero">
          <div className="dda-bank-hero__glow" style={{ background: `${meta.accent}22` }} aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                {accountDisplay.bank}
              </p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">
                {accountDisplay.title}
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                {accountDisplay.type} · {maskAccountNumber(profileId, accountId)}
              </p>
            </div>
            <span className="dda-bank-logo-wrap dda-bank-logo-wrap--hero">
              <BankAccountLogo accountId={accountId} size="lg" />
            </span>
          </div>

          <div className="relative mt-6">
            <p className="text-sm text-gray-400">{t("pages.accounts.availableBalance")}</p>
            <p className="dda-bank-hero__balance">{formatPoolCurrency(balance)}</p>
            <p className="mt-2 text-xs text-gray-500">
              {t("pages.accounts.asOfToday")} · {currentMember.name}
            </p>
            {accountId === "escrow" ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-300 ring-1 ring-sky-400/20">
                {t("pages.accounts.poolSynced")}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {isOverlay ? (
        <>
          {donationReceipt ? (
            <section className="dda-donate-receipt" aria-live="polite">
              <button
                type="button"
                className="dda-donate-receipt__close"
                onClick={() => {
                  setDonationReceipt(null);
                  setStatus("");
                }}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="dda-donate-receipt__badge">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                {t("pages.accounts.donateReceiptTitle")}
              </div>
              <p className="dda-donate-receipt__amount">
                +{formatPoolCurrency(donationReceipt.amount)}
              </p>
              <p className="dda-donate-receipt__recurring">
                {donationReceipt.recurringEnabled
                  ? t("pages.accounts.donateReceiptRecurring", {
                      frequency: t(
                        `pages.accounts.${
                          donationReceipt.frequency === "weekly" ? "freqWeekly" : "freqMonthly"
                        }`,
                      ),
                    })
                  : t("pages.accounts.donateReceiptOneTime")}
              </p>
              <p className="dda-donate-receipt__note">{t("pages.accounts.donateSuccess")}</p>
            </section>
          ) : (
            <section className="dda-wallet-quick-fund">
              <label htmlFor="wallet-quick-amount" className="sr-only">
                {t("pages.accounts.amount")}
              </label>
              <div className="dda-bank-amount-input">
                <input
                  id="wallet-quick-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    clearFundFeedback();
                    handleAmountChange(event.target.value, setAmount);
                  }}
                  placeholder="$0.00"
                  className="w-full bg-transparent text-2xl font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
                />
              </div>

              <label htmlFor="wallet-quick-memo" className="sr-only">
                {t("pages.accounts.memo")}
              </label>
              <input
                id="wallet-quick-memo"
                type="text"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder={t("pages.accounts.memoPlaceholder")}
                className="dda-bank-field"
              />

              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {status ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-dda-green-light">
                  <CheckCircle2 className="h-4 w-4" />
                  {status}
                </p>
              ) : null}

              <div className="dda-bank-actions dda-bank-actions--pair dda-bank-actions--overlay">
                <button
                  type="button"
                  onClick={handleDepositAmount}
                  className="dda-bank-actions__btn dda-bank-actions__btn--active"
                >
                  <span className="dda-bank-actions__icon" aria-hidden="true">
                    <ArrowDownLeft className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span>{t("pages.accounts.actionDeposit")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDonateAmount}
                  className="dda-bank-actions__btn dda-bank-actions__btn--donate"
                >
                  <span className="dda-bank-actions__icon" aria-hidden="true">
                    <HeartHandshake className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="dda-bank-actions__label-swap">
                    <span className="dda-bank-actions__label-swap__default">
                      {t("pages.accounts.actionDonate")}
                    </span>
                    <span className="dda-bank-actions__label-swap__hover" aria-hidden="true">
                      {t("pages.accounts.donateHoverLabel")}
                    </span>
                  </span>
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <>
          <section
            className={cn(
              "dda-bank-actions",
              actionOptions.length === 2 && "dda-bank-actions--pair",
            )}
          >
            {actionOptions.map(({ id, icon: ActionIcon, labelKey }) => {
              const active = activeAction === id;
              const isDonate = id === "donate";
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setError("");
                    setStatus("");
                    if (isDonate) {
                      setActiveAction("donate");
                      setDonateOpen(true);
                      return;
                    }
                    setActiveAction(id);
                  }}
                  className={cn(
                    "dda-bank-actions__btn",
                    active && "dda-bank-actions__btn--active",
                    isDonate && "dda-bank-actions__btn--donate",
                  )}
                >
                  <span className="dda-bank-actions__icon" aria-hidden="true">
                    <ActionIcon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  {isDonate ? (
                    <span className="dda-bank-actions__label-swap">
                      <span className="dda-bank-actions__label-swap__default">
                        {t(`pages.accounts.${labelKey}`)}
                      </span>
                      <span className="dda-bank-actions__label-swap__hover" aria-hidden="true">
                        {t("pages.accounts.donateHoverLabel")}
                      </span>
                    </span>
                  ) : (
                    <span>{t(`pages.accounts.${labelKey}`)}</span>
                  )}
                </button>
              );
            })}
          </section>

          {activeAction === "donate" ? (
            donationReceipt ? (
              <section className="dda-donate-receipt" aria-live="polite">
                <button
                  type="button"
                  className="dda-donate-receipt__close"
                  onClick={() => {
                    setDonationReceipt(null);
                    setStatus("");
                  }}
                  aria-label={t("common.close")}
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="dda-donate-receipt__badge">
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                  {t("pages.accounts.donateReceiptTitle")}
                </div>
                <p className="dda-donate-receipt__amount">
                  +{formatPoolCurrency(donationReceipt.amount)}
                </p>
                <p className="dda-donate-receipt__recurring">
                  {donationReceipt.recurringEnabled
                    ? t("pages.accounts.donateReceiptRecurring", {
                        frequency: t(
                          `pages.accounts.${
                            donationReceipt.frequency === "weekly" ? "freqWeekly" : "freqMonthly"
                          }`,
                        ),
                      })
                    : t("pages.accounts.donateReceiptOneTime")}
                </p>
                <p className="dda-donate-receipt__note">{t("pages.accounts.donateSuccess")}</p>
              </section>
            ) : (
              <DashboardCard
                title={t("pages.accounts.actionDonate")}
                subtitle={t("pages.accounts.donateSub")}
              >
                <button
                  type="button"
                  onClick={() => setDonateOpen(true)}
                  className="dda-btn-primary inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
                >
                  <HeartHandshake className="h-4 w-4" />
                  {t("pages.accounts.donateCta")}
                </button>
              </DashboardCard>
            )
          ) : (
            <DashboardCard
              title={t(
                `pages.accounts.${actionOptions.find((item) => item.id === activeAction)?.labelKey}`,
              )}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {activeAction === "transfer" ? (
                  <div className="dda-bank-transfer-route">
                    <div className="dda-bank-transfer-route__node">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                        {t("pages.accounts.from")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {t(`pages.accounts.${transferFromMeta.labelKey}`)}
                      </p>
                      <p className="text-xs tabular-nums text-gray-400">
                        {formatPoolCurrency(transferFromBalance)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSwapTransferAccounts}
                      className="dda-bank-transfer-route__swap"
                      aria-label={t("pages.accounts.swapAccounts")}
                      title={t("pages.accounts.swapAccounts")}
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                    </button>
                    <div className="dda-bank-transfer-route__node">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500">
                        {t("pages.accounts.to")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {t(`pages.accounts.${transferToMeta.labelKey}`)}
                      </p>
                      <p className="text-xs tabular-nums text-gray-400">
                        {formatPoolCurrency(transferToBalance)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div>
                  <label htmlFor="account-amount" className="mb-1.5 block text-sm text-gray-400">
                    {t("pages.accounts.amount")}
                  </label>
                  <div className="dda-bank-amount-input">
                    <input
                      id="account-amount"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => handleAmountChange(event.target.value, setAmount)}
                      placeholder="$0.00"
                      className="w-full bg-transparent text-2xl font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="account-memo" className="mb-1.5 block text-sm text-gray-400">
                    {t("pages.accounts.memo")}
                  </label>
                  <input
                    id="account-memo"
                    type="text"
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    placeholder={t("pages.accounts.memoPlaceholder")}
                    className="dda-bank-field"
                  />
                </div>

                {error ? <p className="text-sm text-red-400">{error}</p> : null}
                {status ? (
                  <p className="inline-flex items-center gap-1.5 text-sm text-dda-green-light">
                    <CheckCircle2 className="h-4 w-4" />
                    {status}
                  </p>
                ) : null}

                <button type="submit" className="dda-btn-primary w-full py-3 text-sm font-semibold">
                  {t(
                    `pages.accounts.confirm${activeAction.charAt(0).toUpperCase()}${activeAction.slice(1)}`,
                  )}
                </button>
              </form>
            </DashboardCard>
          )}
        </>
      )}

      {donateOpen ? (
        <Suspense fallback={null}>
          <ContributeOnboardingModal
            open={donateOpen}
            onClose={() => setDonateOpen(false)}
            initialAmount={parsedAmount > 0 ? parsedAmount : null}
            startOnCustom={!(parsedAmount > 0)}
            contributionFrequency="monthly"
            onComplete={({ reminderEnabled, recurringEnabled, amount: donatedAmount, frequency }) => {
              saveContribution({
                amount: donatedAmount,
                reminderEnabled,
                recurringEnabled,
                frequency,
              });
              setDonateOpen(false);
              setActiveAction("donate");
              setAmount("");
              setMemo("");
              setDonationReceipt({
                amount: donatedAmount,
                recurringEnabled,
                frequency: frequency === "weekly" ? "weekly" : "monthly",
              });
              setStatus(t("pages.accounts.donateSuccess"));
              onCreditAdded?.(donatedAmount);
            }}
          />
        </Suspense>
      ) : null}

      <DashboardCard
        title={t("pages.accounts.recentActivity")}
        subtitle={
          unifiedWallet
            ? t("pages.accounts.recentActivitySubMember")
            : t("pages.accounts.recentActivitySub")
        }
        collapsible
        defaultCollapsed={false}
        collapseAriaLabel={t("pages.accounts.collapseActivity")}
        expandAriaLabel={t("pages.accounts.expandActivity")}
      >
        {activityActionError ? (
          <p className="mb-3 text-sm text-red-400">{activityActionError}</p>
        ) : null}
        {accountTransactions.length ? (
          <>
            <ul className="dda-bank-ledger">
              {pagedTransactions.map((transaction) => {
              const signedAmount = getSignedAmount(transaction);
              const isEditing = editingTransactionId === transaction.id;
              const canEditLedger = transaction.source === "ledger";
              return (
                <li
                  key={transaction.id}
                  className={cn("dda-bank-ledger__row", isEditing && "dda-bank-ledger__row--editing")}
                >
                  <span className="dda-bank-ledger__icon">
                    <ActivityIcon type={transaction.type} />
                  </span>

                  {isEditing ? (
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-sm font-medium text-white">
                        {getTransactionTitle(transaction, t)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatAccountTransactionTime(transaction.createdAt, locale)}
                      </p>
                      <div className="dda-bank-amount-input !py-2">
                        <input
                          inputMode="decimal"
                          value={editAmount}
                          onChange={(event) => handleAmountChange(event.target.value, setEditAmount)}
                          placeholder="$0.00"
                          className="w-full bg-transparent text-lg font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
                          aria-label={t("pages.accounts.amount")}
                        />
                      </div>
                      <input
                        type="text"
                        value={editMemo}
                        onChange={(event) => setEditMemo(event.target.value)}
                        placeholder={t("pages.accounts.memoPlaceholder")}
                        className="dda-bank-field !py-2 text-sm"
                        aria-label={t("pages.accounts.memo")}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveEditTransaction}
                          className="dda-bank-ledger__action-btn dda-bank-ledger__action-btn--save"
                          aria-label={t("pages.accounts.saveEdit")}
                        >
                          <Check className="h-3.5 w-3.5" />
                          {t("pages.accounts.saveEdit")}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditTransaction}
                          className="dda-bank-ledger__action-btn"
                          aria-label={t("pages.accounts.cancelEdit")}
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("pages.accounts.cancelEdit")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-tight text-white">
                          {getTransactionTitle(transaction, t)}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-tight text-gray-500">
                          {formatAccountTransactionTime(transaction.createdAt, locale)}
                          {transaction.memo ? ` · ${transaction.memo}` : ""}
                        </span>
                      </span>
                      <span className="text-right leading-tight">
                        <span
                          className={cn(
                            "block text-[13px] font-bold tabular-nums",
                            signedAmount >= 0 ? "text-dda-green-light" : "text-red-400",
                          )}
                        >
                          {signedAmount >= 0 ? "+" : "−"}
                          {formatPoolCurrency(Math.abs(signedAmount))}
                        </span>
                        {Number.isFinite(transaction.balanceAfter) ? (
                          <span className="block text-[10px] tabular-nums text-gray-500">
                            {formatPoolCurrency(transaction.balanceAfter)}
                          </span>
                        ) : null}
                      </span>
                      {canEditLedger ? (
                        <span className="dda-bank-ledger__actions">
                          <button
                            type="button"
                            onClick={() => startEditTransaction(transaction)}
                            className="dda-bank-ledger__icon-btn"
                            aria-label={t("pages.accounts.editTransaction")}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="dda-bank-ledger__icon-btn dda-bank-ledger__icon-btn--danger"
                            aria-label={t("pages.accounts.deleteTransaction")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ) : null}
                    </>
                  )}
                </li>
              );
              })}
            </ul>
            {totalActivityPages > 1 ? (
              <div className="dda-bank-ledger-pager">
                <button
                  type="button"
                  disabled={activityPage === 0}
                  onClick={() => setActivityPage((page) => Math.max(0, page - 1))}
                  className="dda-bank-ledger-pager__btn"
                >
                  {t("pages.accounts.previousPage")}
                </button>
                <span className="dda-bank-ledger-pager__label">
                  {t("pages.accounts.pageOf", {
                    current: activityPage + 1,
                    total: totalActivityPages,
                  })}
                </span>
                <button
                  type="button"
                  disabled={activityPage >= totalActivityPages - 1}
                  onClick={() =>
                    setActivityPage((page) => Math.min(totalActivityPages - 1, page + 1))
                  }
                  className="dda-bank-ledger-pager__btn"
                >
                  {t("pages.accounts.nextPage")}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="dda-panel rounded-xl p-6 text-center text-sm text-gray-500">
            {unifiedWallet ? t("pages.accounts.noActivityMember") : t("pages.accounts.noActivity")}
          </div>
        )}
      </DashboardCard>

      {!isOverlay ? (
        <>
          <RecurringCashflowPanel accountId={accountId} />
          <WalletFundingTabs />
        </>
      ) : null}
    </div>
  );
}
