import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { resolveMemberProfileId, useMemberAccounts } from "../../lib/memberAccounts";
import { formatEasternShortDate, formatEasternIsoDate } from "../../lib/dateTime";
import {
  addRecurringCashflow,
  deleteRecurringCashflow,
  getNextDueDate,
  updateRecurringCashflow,
  useRecurringCashflows,
} from "../../lib/recurringCashflow";
import RecurringDateCalendar from "./RecurringDateCalendar";

const ACCOUNT_OPTIONS = [
  { id: "checking", labelKey: "checkingTab" },
  { id: "escrow", labelKey: "escrowTab" },
];

const FREQUENCY_OPTIONS = [
  { id: "daily", labelKey: "freqDaily" },
  { id: "weekly", labelKey: "freqWeekly" },
  { id: "biweekly", labelKey: "freqBiweekly" },
  { id: "monthly", labelKey: "freqMonthly" },
  { id: "yearly", labelKey: "freqYearly" },
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

export default function RecurringCashflowPanel({ accountId = null }) {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const ledger = useMemberAccounts(profileId);
  const schedules = useRecurringCashflows(profileId);

  const [type, setType] = useState("income");
  const [selectedAccountId, setSelectedAccountId] = useState(accountId ?? "checking");
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

  useEffect(() => {
    if (accountId) {
      setSelectedAccountId(accountId);
      setTransferFromId(accountId);
      setTransferToId(accountId === "checking" ? "escrow" : "checking");
    }
  }, [accountId]);

  const transferFromBalance =
    transferFromId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;
  const transferToBalance =
    transferToId === "checking" ? ledger.checkingBalance : ledger.escrowBalance;

  const visibleSchedules = useMemo(() => {
    if (!accountId) return schedules;
    return schedules.filter((item) => {
      if (item.type === "transfer") {
        return item.accountId === accountId || item.transferToAccountId === accountId;
      }
      return item.accountId === accountId;
    });
  }, [schedules, accountId]);

  const handleSwapTransferAccounts = () => {
    setTransferFromId(transferToId);
    setTransferToId(transferFromId);
    setError("");
  };

  const resetForm = () => {
    setAmount("");
    setLabel("");
    setStartDate(formatEasternIsoDate());
    setError("");
  };

  const handleAdd = (event) => {
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

    const result = addRecurringCashflow({
      profileId,
      accountId: type === "transfer" ? transferFromId : accountId ?? selectedAccountId,
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
      title={t("pages.accounts.recurringTitle")}
      subtitle={t("pages.accounts.recurringSub")}
      collapsible
      defaultCollapsed
      collapseAriaLabel={t("pages.accounts.collapseRecurring")}
      expandAriaLabel={t("pages.accounts.expandRecurring")}
    >
      <form onSubmit={handleAdd} className="dda-recurring-form space-y-4">
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
                className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none"
              >
                {ACCOUNT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="bg-dda-bg text-white">
                    {t(`pages.accounts.${option.labelKey}`)}
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
                className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none"
              >
                {ACCOUNT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id} className="bg-dda-bg text-white">
                    {t(`pages.accounts.${option.labelKey}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs tabular-nums text-gray-400">
                {formatPoolCurrency(transferToBalance)}
              </p>
            </div>
          </div>
        ) : (
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
                {ACCOUNT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {t(`pages.accounts.${option.labelKey}`)}
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
        )}

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
          <RecurringDateCalendar value={startDate} onChange={setStartDate} />
        </div>

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

        <button type="submit" className="dda-btn-primary inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold">
          <Plus className="h-4 w-4" />
          {t("pages.accounts.recurringAdd")}
        </button>
      </form>

      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
          {accountId
            ? t("pages.accounts.recurringListAccount")
            : t("pages.accounts.recurringListAll")}
        </p>

        {visibleSchedules.length ? (
          <ul className="dda-recurring-list">
            {visibleSchedules.map((schedule) => {
              const nextDue = getNextDueDate(schedule);
              const accountLabel = t(
                `pages.accounts.${ACCOUNT_OPTIONS.find((item) => item.id === schedule.accountId)?.labelKey ?? "checkingTab"}`,
              );
              const transferToLabel =
                schedule.type === "transfer" && schedule.transferToAccountId
                  ? t(
                      `pages.accounts.${ACCOUNT_OPTIONS.find((item) => item.id === schedule.transferToAccountId)?.labelKey ?? "escrowTab"}`,
                    )
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
                      {schedule.label || t("pages.accounts.recurringUntitled")}
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
        ) : (
          <div className="dda-panel rounded-xl p-5 text-center text-sm text-gray-500">
            {t("pages.accounts.recurringEmpty")}
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
