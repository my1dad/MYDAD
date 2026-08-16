import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import { formatEasternShortDate, formatEasternIsoDate } from "../../lib/dateTime";
import {
  addRecurringCashflow,
  collectDueDates,
  deleteRecurringCashflow,
  ensureHomeContributionSchedulesFromContributions,
  getNextDueDate,
  isHomeContributionSchedule,
  payRecurringOccurrenceNow,
  processRecurringCashflows,
  updateRecurringCashflow,
  useRecurringCashflows,
} from "../../lib/recurringCashflow";
import RecurringDateCalendar from "./RecurringDateCalendar";

import { getAccountDisplay } from "./accountDisplay";

const ACCOUNT_OPTIONS = [
  { id: "checking", labelKey: "checkingTab" },
  { id: "escrow", labelKey: "escrowTab" },
];

function getAccountOptionLabel(id, isAdmin, t) {
  return getAccountDisplay(id, isAdmin, t)?.title ?? t("pages.accounts.checkingTab");
}

const FREQUENCY_OPTIONS = [
  { id: "daily", labelKey: "freqDaily" },
  { id: "weekly", labelKey: "freqWeekly" },
  { id: "biweekly", labelKey: "freqBiweekly" },
  { id: "monthly", labelKey: "freqMonthly" },
  { id: "yearly", labelKey: "freqYearly" },
];

const RECURRING_LIST_PAGE_SIZE = 5;
const COLLAPSED_PREVIEW_SIZE = 6;

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

  if (sanitized.endsWith(".")) return `$${formattedWhole}.`;
  if (decimalPart !== undefined) return `$${formattedWhole}.${decimalPart}`;
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

export default function RecurringCashflowPanel({
  accountId = null,
  defaultCollapsed = true,
  expandAsOverlay = false,
}) {
  const { t } = useLocale();
  const { isAdmin, profile } = useDadAuth();
  // Prefer the signed-in profile so member calendars never mix other accounts.
  const profileId = profile?.id || resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const schedules = useRecurringCashflows(profileId);
  const unifiedWallet = !isAdmin;
  const memberLedgerAccountId = "escrow";
  const accountOptions = useMemo(
    () => (unifiedWallet ? ACCOUNT_OPTIONS.filter((option) => option.id === "checking") : ACCOUNT_OPTIONS),
    [unifiedWallet],
  );

  const [type, setType] = useState("income");
  const [selectedAccountId, setSelectedAccountId] = useState(
    unifiedWallet ? "checking" : accountId ?? "checking",
  );
  const [transferFromId, setTransferFromId] = useState(accountId ?? "checking");
  const [transferToId, setTransferToId] = useState(
    accountId === "checking" ? "escrow" : accountId === "escrow" ? "checking" : "escrow",
  );
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState(() => formatEasternIsoDate());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [listVisibleCount, setListVisibleCount] = useState(RECURRING_LIST_PAGE_SIZE);

  const transferFromBalance =
    transferFromId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;
  const transferToBalance =
    transferToId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;

  const visibleSchedules = useMemo(() => {
    const ownerId = String(profileId ?? "").trim();
    const owned = schedules.filter((item) => String(item.profileId ?? "").trim() === ownerId);
    const walletAccountIds = new Set(["checking", "escrow"]);
    const scoped = !accountId
      ? owned
      : owned.filter((item) => {
          if (unifiedWallet && accountId === "checking") {
            if (item.type === "transfer") return false;
            return walletAccountIds.has(item.accountId);
          }
          if (item.type === "transfer") {
            return item.accountId === accountId || item.transferToAccountId === accountId;
          }
          return item.accountId === accountId;
        });
    if (isAdmin) return scoped;
    // Keep donation schedules visible; hide other internal transfers.
    return scoped.filter(
      (item) => item.type !== "transfer" || isHomeContributionSchedule(item),
    );
  }, [schedules, accountId, isAdmin, unifiedWallet, profileId]);

  useEffect(() => {
    setListVisibleCount(RECURRING_LIST_PAGE_SIZE);
  }, [profileId, accountId, visibleSchedules.length]);

  const listedSchedules = useMemo(
    () => visibleSchedules.slice(0, listVisibleCount),
    [visibleSchedules, listVisibleCount],
  );
  const hasMoreSchedules = listedSchedules.length < visibleSchedules.length;

  const unpaidDue = useMemo(() => {
    const today = formatEasternIsoDate();
    return visibleSchedules.flatMap((schedule) =>
      collectDueDates(schedule, today).map((dayYmd) => ({ schedule, dayYmd })),
    );
  }, [visibleSchedules]);

  const previewSchedules = useMemo(() => {
    return [...visibleSchedules]
      .map((schedule) => ({ schedule, nextDue: getNextDueDate(schedule) }))
      .sort((a, b) => {
        if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue);
        if (a.nextDue) return -1;
        if (b.nextDue) return 1;
        return 0;
      })
      .slice(0, COLLAPSED_PREVIEW_SIZE);
  }, [visibleSchedules]);

  useEffect(() => {
    ensureHomeContributionSchedulesFromContributions(profileId);
    processRecurringCashflows();
  }, [profileId]);

  useEffect(() => {
    if (!unpaidDue.length) return;
    processRecurringCashflows();
  }, [unpaidDue.length]);

  useEffect(() => {
    if (accountId) {
      setSelectedAccountId(unifiedWallet ? "checking" : accountId);
      setTransferFromId(accountId);
      setTransferToId(accountId === "checking" ? "escrow" : "checking");
    }
  }, [accountId, unifiedWallet]);

  useEffect(() => {
    // Members create income-only schedules; keep existing type while editing.
    if (!isAdmin && !editingId && type !== "income") {
      setType("income");
    }
  }, [isAdmin, type, editingId]);

  const handleSwapTransferAccounts = () => {
    setTransferFromId(transferToId);
    setTransferToId(transferFromId);
    setError("");
  };

  const resetForm = () => {
    setAmount("");
    setLabel("");
    setStartDate(formatEasternIsoDate());
    setEditingId(null);
    setError("");
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule.id);
    setType(schedule.type);
    setAmount(formatMoneyInput(String(schedule.amount)));
    setFrequency(schedule.frequency);
    setLabel(schedule.label);
    setStartDate(schedule.startDate);
    setError("");
    setStatus("");

    if (schedule.type === "transfer") {
      setTransferFromId(schedule.accountId);
      setTransferToId(schedule.transferToAccountId ?? "escrow");
    } else {
      setSelectedAccountId(schedule.accountId);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const parsed = parseAmount(amount);
    if (parsed <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }
    if (!label.trim()) {
      setError(t("pages.accounts.recurringLabelRequired"));
      return;
    }
    if (type === "transfer" && transferFromId === transferToId) {
      setError(t("pages.accounts.recurringTransferInvalid"));
      return;
    }

    const resolveLedgerAccountId = () => {
      if (type === "transfer") return transferFromId;
      if (unifiedWallet) return memberLedgerAccountId;
      return accountId ?? selectedAccountId;
    };

    if (editingId) {
      const result = updateRecurringCashflow(editingId, {
        accountId: resolveLedgerAccountId(),
        transferToAccountId: type === "transfer" ? transferToId : undefined,
        type,
        amount: parsed,
        frequency,
        label: label.trim(),
        startDate,
      });

      if (!result) {
        setError(t("pages.accounts.recurringUpdateFailed"));
        return;
      }

      resetForm();
      setStatus(t("pages.accounts.recurringUpdated"));
      return;
    }

    const result = addRecurringCashflow({
      profileId,
      accountId: resolveLedgerAccountId(),
      transferToAccountId: type === "transfer" ? transferToId : undefined,
      type,
      amount: parsed,
      frequency,
      label: label.trim(),
      startDate,
    });

    if (!result) {
      setError(t("pages.accounts.recurringAddFailed"));
      return;
    }

    resetForm();
    setStatus(t("pages.accounts.recurringAdded"));
  };

  const handleToggle = (schedule) => {
    updateRecurringCashflow(schedule.id, { enabled: !schedule.enabled });
  };

  const handleDelete = (scheduleId) => {
    if (!window.confirm(t("pages.accounts.confirmDeleteRecurring"))) return;
    deleteRecurringCashflow(scheduleId);
  };

  return (
    <DashboardCard
      title={t(
        isAdmin ? "pages.accounts.recurringTitle" : "pages.accounts.recurringTitleMember",
      )}
      collapsible
      defaultCollapsed={defaultCollapsed}
      expandAsOverlay={expandAsOverlay}
      collapseAriaLabel={t("pages.accounts.collapseRecurring")}
      expandAriaLabel={t("pages.accounts.expandRecurring")}
      collapsedPreview={
        previewSchedules.length ? (
          <ul className="dda-bank-ledger">
            {previewSchedules.map(({ schedule, nextDue }) => {
              const freqLabel = t(
                `pages.accounts.${FREQUENCY_OPTIONS.find((item) => item.id === schedule.frequency)?.labelKey ?? "freqMonthly"}`,
              );
              const label = isHomeContributionSchedule(schedule)
                ? t("pages.accounts.recurringDonationLabelWithAmount", {
                    amount: formatPoolCurrency(schedule.amount),
                  })
                : schedule.label || t("pages.accounts.recurringUntitled");

              return (
                <li key={schedule.id} className="dda-bank-ledger__row">
                  <span
                    className={cn(
                      "dda-bank-ledger__icon",
                      schedule.type === "income" && "dda-bank-ledger__icon--income",
                      schedule.type === "expense" && "dda-bank-ledger__icon--expense",
                      schedule.type === "transfer" && "dda-bank-ledger__icon--transfer",
                    )}
                  >
                    {schedule.type === "income" ? (
                      <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
                    ) : schedule.type === "expense" ? (
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                    ) : (
                      <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-tight text-white">
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-gray-500">
                      {freqLabel}
                      {nextDue
                        ? ` · ${t("pages.accounts.recurringNextDue", {
                            date: formatEasternShortDate(nextDue),
                          })}`
                        : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      schedule.type === "income" && "text-dda-green-light",
                      schedule.type === "expense" && "text-red-400",
                      schedule.type === "transfer" && "text-sky-300",
                    )}
                  >
                    {schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔"}
                    {formatPoolCurrency(schedule.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="dda-card-collapsed-preview__empty">
            {t("pages.accounts.recurringEmpty")}
          </p>
        )
      }
    >
      {unpaidDue.length ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-semibold">{t("pages.accounts.recurringUnpaidTitle")}</p>
          <ul className="mt-2 space-y-1.5">
            {unpaidDue.map(({ schedule, dayYmd }) => {
              const accountBalance = unifiedWallet
                ? ledger.checkingBalance + ledger.escrowBalance
                : schedule.accountId === "checking"
                  ? ledger.checkingBalance
                  : ledger.escrowBalance;
              const accountLabel = getAccountOptionLabel(
                unifiedWallet ? "checking" : schedule.accountId,
                isAdmin,
                t,
              );
              return (
                <li key={`${schedule.id}-${dayYmd}`} className="text-xs text-amber-100/90">
                  {t("pages.accounts.recurringUnpaidItem", {
                    label: schedule.label || t("pages.accounts.recurringUntitled"),
                    date: formatEasternShortDate(dayYmd),
                    amount: formatPoolCurrency(schedule.amount),
                    account: accountLabel,
                    balance: formatPoolCurrency(accountBalance),
                  })}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-amber-200/70">
            {t("pages.accounts.recurringUnpaidHint")}
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="dda-recurring-form space-y-4">
        {isAdmin ? (
          <div className="dda-recurring-type">
            <button
              type="button"
              onClick={() => setType("income")}
              className={cn(
                "dda-recurring-type__btn",
                type === "income" && "dda-recurring-type__btn--income",
              )}
            >
              <ArrowDownLeft className="h-4 w-4" />
              {t("pages.accounts.recurringIncome")}
            </button>
            <button
              type="button"
              onClick={() => setType("expense")}
              className={cn(
                "dda-recurring-type__btn",
                type === "expense" && "dda-recurring-type__btn--expense",
              )}
            >
              <ArrowUpRight className="h-4 w-4" />
              {t("pages.accounts.recurringExpense")}
            </button>
            <button
              type="button"
              onClick={() => setType("transfer")}
              className={cn(
                "dda-recurring-type__btn",
                type === "transfer" && "dda-recurring-type__btn--transfer",
              )}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {t("pages.accounts.recurringTransfer")}
            </button>
          </div>
        ) : null}

        {type === "transfer" ? (
          <div className="dda-bank-transfer-route">
            <div className="dda-bank-transfer-route__node">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                {t("pages.accounts.from")}
              </p>
              <label htmlFor="recurring-transfer-from" className="sr-only">
                {t("pages.accounts.from")}
              </label>
              <select
                id="recurring-transfer-from"
                value={transferFromId}
                onChange={(event) => setTransferFromId(event.target.value)}
                className="dda-bank-transfer-route__select w-full"
              >
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-dda-bg text-white">
                    {getAccountOptionLabel(option.id, isAdmin, t)}
                  </option>
                ))}
              </select>
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
              <label htmlFor="recurring-transfer-to" className="sr-only">
                {t("pages.accounts.to")}
              </label>
              <select
                id="recurring-transfer-to"
                value={transferToId}
                onChange={(event) => setTransferToId(event.target.value)}
                className="dda-bank-transfer-route__select w-full"
              >
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-dda-bg text-white">
                    {getAccountOptionLabel(option.id, isAdmin, t)}
                  </option>
                ))}
              </select>
              <p className="text-xs tabular-nums text-gray-400">
                {formatPoolCurrency(transferToBalance)}
              </p>
            </div>
          </div>
        ) : isAdmin ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {!accountId ? (
            <div>
              <label htmlFor="recurring-account" className="mb-1.5 block text-sm text-gray-400">
                {t("pages.accounts.recurringAccount")}
              </label>
              <select
                id="recurring-account"
                value={selectedAccountId}
                onChange={(event) => setSelectedAccountId(event.target.value)}
                className="dda-bank-field w-full"
              >
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {getAccountOptionLabel(option.id, isAdmin, t)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className={accountId ? "sm:col-span-2" : ""}>
            <label htmlFor="recurring-frequency" className="mb-1.5 block text-sm text-gray-400">
              {t("pages.accounts.recurringFrequency")}
            </label>
            <select
              id="recurring-frequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              className="dda-bank-field w-full"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`pages.accounts.${option.labelKey}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        ) : null}

        {type === "transfer" ? (
          <div>
            <label htmlFor="recurring-frequency-transfer" className="mb-1.5 block text-sm text-gray-400">
              {t("pages.accounts.recurringFrequency")}
            </label>
            <select
              id="recurring-frequency-transfer"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
              className="dda-bank-field w-full"
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {t(`pages.accounts.${option.labelKey}`)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <p className="mb-1.5 block text-sm text-gray-400">
            {t("pages.accounts.recurringStartDate")}
          </p>
          <RecurringDateCalendar
            value={startDate}
            onChange={setStartDate}
            schedules={visibleSchedules}
            onEditSchedule={handleEdit}
            onDeleteSchedule={handleDelete}
            onPayOccurrence={payRecurringOccurrenceNow}
          />
        </div>

        {isAdmin || editingId ? (
          <>
            <div>
              <label htmlFor="recurring-amount" className="mb-1.5 block text-sm text-gray-400">
                {t("pages.accounts.amount")}
              </label>
              <div className="dda-bank-amount-input">
                <input
                  id="recurring-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => handleAmountChange(event.target.value, setAmount)}
                  placeholder="$0.00"
                  className="w-full bg-transparent text-xl font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="recurring-label" className="mb-1.5 block text-sm text-gray-400">
                {t("pages.accounts.recurringLabel")}
              </label>
              <input
                id="recurring-label"
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t("pages.accounts.recurringLabelPlaceholder")}
                className="dda-bank-field"
              />
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {status ? <p className="text-sm text-dda-green-light">{status}</p> : null}

            <div className="flex gap-2">
              <button
                type="submit"
                className="dda-btn-primary inline-flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold"
              >
                {editingId ? (
                  <>
                    <Pencil className="h-4 w-4" />
                    {t("pages.accounts.recurringUpdate")}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {t("pages.accounts.recurringAdd")}
                  </>
                )}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="dda-bank-ledger__action-btn shrink-0 px-4 py-3 text-sm"
                >
                  {t("pages.accounts.cancelEdit")}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </form>

      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
          {accountId
            ? t("pages.accounts.recurringListAccount")
            : t("pages.accounts.recurringListAll")}
        </p>

        {visibleSchedules.length ? (
          <>
            <ul className="dda-recurring-list">
              {listedSchedules.map((schedule) => {
                const nextDue = getNextDueDate(schedule);
                const accountLabel = getAccountOptionLabel(schedule.accountId, isAdmin, t);
                const transferToLabel =
                  schedule.type === "transfer" && schedule.transferToAccountId
                    ? getAccountOptionLabel(schedule.transferToAccountId, isAdmin, t)
                    : null;
                const freqLabel = t(
                  `pages.accounts.${FREQUENCY_OPTIONS.find((item) => item.id === schedule.frequency)?.labelKey ?? "freqMonthly"}`,
                );

                return (
                  <li
                    key={schedule.id}
                    className={cn(
                      "dda-recurring-list__item",
                      !schedule.enabled && "dda-recurring-list__item--paused",
                      editingId === schedule.id && "dda-recurring-list__item--editing",
                    )}
                  >
                    <span
                      className={cn(
                        "dda-recurring-list__icon",
                        schedule.type === "income" && "dda-recurring-list__icon--income",
                        schedule.type === "expense" && "dda-recurring-list__icon--expense",
                        schedule.type === "transfer" && "dda-recurring-list__icon--transfer",
                      )}
                    >
                      {schedule.type === "income" ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : schedule.type === "expense" ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowLeftRight className="h-4 w-4" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">
                        {isHomeContributionSchedule(schedule)
                          ? t("pages.accounts.recurringDonationLabelWithAmount", {
                              amount: formatPoolCurrency(schedule.amount),
                            })
                          : schedule.label || t("pages.accounts.recurringUntitled")}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                        <span>{freqLabel}</span>
                        {schedule.type === "transfer" && transferToLabel ? (
                          <span>
                            {t("pages.accounts.recurringTransferRoute", {
                              from: accountLabel,
                              to: transferToLabel,
                            })}
                          </span>
                        ) : !accountId ? (
                          <span>· {accountLabel}</span>
                        ) : null}
                        {schedule.startDate ? (
                          <span>
                            {t("pages.accounts.recurringStartsOn", {
                              date: formatEasternShortDate(schedule.startDate),
                            })}
                          </span>
                        ) : null}
                        {nextDue ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {t("pages.accounts.recurringNextDue", {
                              date: formatEasternShortDate(nextDue),
                            })}
                          </span>
                        ) : null}
                      </span>
                    </span>

                    <span className="text-right">
                      <span
                        className={cn(
                          "block text-sm font-bold tabular-nums",
                          schedule.type === "income" && "text-dda-green-light",
                          schedule.type === "expense" && "text-red-400",
                          schedule.type === "transfer" && "text-sky-300",
                        )}
                      >
                        {schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔"}
                        {formatPoolCurrency(schedule.amount)}
                      </span>
                      <span className="block text-[10px] text-gray-500">
                        {schedule.enabled
                          ? t("pages.accounts.recurringActive")
                          : t("pages.accounts.recurringPaused")}
                      </span>
                    </span>

                    <span className="dda-recurring-list__actions">
                      <button
                        type="button"
                        onClick={() => handleEdit(schedule)}
                        className="dda-bank-ledger__icon-btn"
                        aria-label={t("pages.accounts.recurringEdit")}
                        aria-pressed={editingId === schedule.id}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(schedule)}
                        className="dda-bank-ledger__icon-btn"
                        aria-label={
                          schedule.enabled
                            ? t("pages.accounts.recurringPause")
                            : t("pages.accounts.recurringResume")
                        }
                      >
                        {schedule.enabled ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(schedule.id)}
                        className="dda-bank-ledger__icon-btn dda-bank-ledger__icon-btn--danger"
                        aria-label={t("pages.accounts.recurringDelete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>

            {hasMoreSchedules ? (
              <button
                type="button"
                className="dda-recurring-list__load-more"
                onClick={() =>
                  setListVisibleCount((count) => count + RECURRING_LIST_PAGE_SIZE)
                }
              >
                {t("pages.accounts.recurringLoadMore", {
                  remaining: visibleSchedules.length - listedSchedules.length,
                })}
              </button>
            ) : null}
          </>
        ) : (
          <div className="dda-panel rounded-xl p-5 text-center text-sm text-gray-500">
            {t("pages.accounts.recurringEmpty")}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
