import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleDollarSign,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { formatEasternShortDate } from "../../lib/dateTime";
import {
  getNextDueDate,
  isHomeContributionSchedule,
  isOccurrenceSettled,
  scheduleOccursOnDate,
} from "../../lib/recurringCashflow";

const ACCOUNT_LABEL_KEYS = {
  checking: "checkingTab",
  escrow: "escrowTab",
};

const FREQUENCY_LABEL_KEYS = {
  daily: "freqDaily",
  weekly: "freqWeekly",
  biweekly: "freqBiweekly",
  monthly: "freqMonthly",
  yearly: "freqYearly",
};

function TypeIcon({ type }) {
  if (type === "income") return <ArrowDownLeft className="h-4 w-4 text-dda-green-light" />;
  if (type === "expense") return <ArrowUpRight className="h-4 w-4 text-red-400" />;
  return <ArrowLeftRight className="h-4 w-4 text-sky-300" />;
}

function typeLabelKey(type) {
  return `pages.accounts.recurring${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function accountLabel(schedule, t) {
  const from = t(
    `pages.accounts.${ACCOUNT_LABEL_KEYS[schedule.accountId] ?? "checkingTab"}`,
  );
  if (schedule.type !== "transfer" || !schedule.transferToAccountId) return from;
  const to = t(
    `pages.accounts.${ACCOUNT_LABEL_KEYS[schedule.transferToAccountId] ?? "escrowTab"}`,
  );
  return t("pages.accounts.recurringTransferRoute", { from, to });
}

function buildDaySummary(items) {
  return items.reduce(
    (summary, { schedule }) => {
      if (schedule.type === "income") summary.income += 1;
      else if (schedule.type === "expense") summary.expense += 1;
      else summary.transfer += 1;
      return summary;
    },
    { income: 0, expense: 0, transfer: 0 },
  );
}

function scheduleTitle(schedule, t) {
  if (isHomeContributionSchedule(schedule)) {
    return t("pages.accounts.recurringDonationLabel");
  }
  return schedule.label || t("pages.accounts.recurringUntitled");
}

function ScheduleCard({
  schedule,
  dayYmd,
  onDate,
  settled,
  onEdit,
  onDelete,
  onPayNow,
  t,
  locale,
}) {
  const sign = schedule.type === "income" ? "+" : schedule.type === "expense" ? "−" : "↔";
  const freqLabel = t(
    `pages.accounts.${FREQUENCY_LABEL_KEYS[schedule.frequency] ?? "freqMonthly"}`,
  );
  const nextDue = !onDate && schedule.enabled ? getNextDueDate(schedule) : null;

  return (
    <li
      className={cn(
        "dda-recurring-day-modal__card",
        !schedule.enabled && "dda-recurring-day-modal__card--paused",
        onDate && "dda-recurring-day-modal__card--on-date",
      )}
    >
      <div className="dda-recurring-day-modal__card-head">
        <div className="dda-recurring-day-modal__card-title">
          <span
            className={cn(
              "dda-recurring-day-modal__icon",
              schedule.type === "income" && "dda-recurring-day-modal__icon--income",
              schedule.type === "expense" && "dda-recurring-day-modal__icon--expense",
              schedule.type === "transfer" && "dda-recurring-day-modal__icon--transfer",
            )}
          >
            <TypeIcon type={schedule.type} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{scheduleTitle(schedule, t)}</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {t(typeLabelKey(schedule.type))} · {freqLabel}
            </p>
          </div>
        </div>
        <div className="dda-recurring-day-modal__card-amount">
          <p
            className={cn(
              "text-base font-bold tabular-nums",
              schedule.type === "income" && "text-dda-green-light",
              schedule.type === "expense" && "text-red-400",
              schedule.type === "transfer" && "text-sky-300",
            )}
          >
            {sign}
            {formatPoolCurrency(schedule.amount)}
          </p>
          {onDate ? (
            <span className="dda-recurring-day-modal__badge dda-recurring-day-modal__badge--on-date">
              {t("pages.accounts.recurringCalendarDayDue")}
            </span>
          ) : null}
          {settled ? (
            <span className="dda-recurring-day-modal__paid">
              {t("pages.accounts.recurringCalendarPaid")}
            </span>
          ) : null}
          {!schedule.enabled ? (
            <span className="dda-recurring-day-modal__badge dda-recurring-day-modal__badge--paused">
              {t("pages.accounts.recurringPaused")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="dda-recurring-day-modal__meta">
        <span className="dda-recurring-day-modal__meta-label">
          {t("pages.accounts.recurringCalendarColAccount")}
        </span>
        <span className="dda-recurring-day-modal__meta-value">{accountLabel(schedule, t)}</span>
      </div>

      {nextDue ? (
        <p className="dda-recurring-day-modal__next">
          {t("pages.accounts.recurringNextDue", {
            date: formatEasternShortDate(nextDue, locale),
          })}
        </p>
      ) : null}

      <div className="dda-recurring-day-modal__actions">
        <button
          type="button"
          className="dda-recurring-day-modal__action"
          aria-label={t("pages.accounts.recurringEdit")}
          onClick={() => onEdit(schedule)}
        >
          <Pencil className="h-3.5 w-3.5" />
          {t("pages.accounts.recurringEditShort")}
        </button>
        <button
          type="button"
          className="dda-recurring-day-modal__action dda-recurring-day-modal__action--danger"
          aria-label={t("pages.accounts.recurringDelete")}
          onClick={() => onDelete(schedule.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("pages.accounts.recurringDeleteShort")}
        </button>
        <button
          type="button"
          className="dda-recurring-day-modal__action dda-recurring-day-modal__action--pay"
          aria-label={t("pages.accounts.recurringPayNow")}
          disabled={!onDate || settled || !schedule.enabled}
          onClick={() => onPayNow(schedule.id, dayYmd)}
        >
          <CircleDollarSign className="h-3.5 w-3.5" />
          {t("pages.accounts.recurringPayNow")}
        </button>
      </div>
    </li>
  );
}

export default function RecurringCalendarDayModal({
  open,
  dayYmd,
  schedules = [],
  onClose,
  onEdit,
  onDelete,
  onPayNow,
  payStatus,
}) {
  const { t, locale } = useLocale();

  const items = useMemo(() => {
    if (!dayYmd) return [];

    const typeOrder = { income: 0, expense: 1, transfer: 2 };
    return [...schedules]
      .map((schedule) => {
        const onDate = scheduleOccursOnDate(schedule, dayYmd);
        return {
          schedule,
          onDate,
          settled: onDate ? isOccurrenceSettled(schedule, dayYmd) : false,
        };
      })
      .sort((a, b) => {
        if (a.onDate !== b.onDate) return a.onDate ? -1 : 1;
        if (a.schedule.enabled !== b.schedule.enabled) return a.schedule.enabled ? -1 : 1;
        const typeDiff = typeOrder[a.schedule.type] - typeOrder[b.schedule.type];
        if (typeDiff !== 0) return typeDiff;
        return scheduleTitle(a.schedule, t).localeCompare(scheduleTitle(b.schedule, t));
      });
  }, [schedules, dayYmd, t]);

  const onDateItems = useMemo(() => items.filter((item) => item.onDate), [items]);
  const otherItems = useMemo(() => items.filter((item) => !item.onDate), [items]);
  const summary = useMemo(() => buildDaySummary(onDateItems), [onDateItems]);
  const onDateDonationTotal = useMemo(
    () =>
      onDateItems
        .filter(
          (item) =>
            isHomeContributionSchedule(item.schedule) || item.schedule.type === "income",
        )
        .reduce((sum, item) => sum + (Number(item.schedule.amount) || 0), 0),
    [onDateItems],
  );
  const onDateDonationCount = useMemo(
    () =>
      onDateItems.filter(
        (item) =>
          isHomeContributionSchedule(item.schedule) || item.schedule.type === "income",
      ).length,
    [onDateItems],
  );

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open || !dayYmd) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-day-modal-title"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
              {t("pages.accounts.recurringCalendarDayTitle")}
            </p>
            <h2 id="recurring-day-modal-title" className="mt-1 text-lg font-semibold text-white">
              {formatEasternShortDate(dayYmd, locale)}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("pages.accounts.recurringCalendarDaySubAll", {
                onDate: onDateItems.length,
                total: items.length,
              })}
            </p>
            {onDateDonationCount > 0 ? (
              <div className="dda-recurring-day-modal__header-total">
                <span>{t("pages.accounts.recurringCalendarDayDonationTotalLabel")}</span>
                <strong className="tabular-nums">+{formatPoolCurrency(onDateDonationTotal)}</strong>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="dda-scroll overflow-y-auto px-5 py-4">
          {payStatus ? (
            <p
              className={cn(
                "mb-4 rounded-xl border px-3 py-2.5 text-sm",
                payStatus.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-dda-green/30 bg-dda-green/10 text-dda-green-light",
              )}
            >
              {payStatus.message}
            </p>
          ) : null}

          {onDateItems.length ? (
            <ul className="dda-recurring-day-modal__summary">
              {summary.income > 0 ? (
                <li className="dda-recurring-day-modal__summary-chip dda-recurring-day-modal__summary-chip--income">
                  {t("pages.accounts.recurringCalendarDayIncome", { count: summary.income })}
                </li>
              ) : null}
              {summary.expense > 0 ? (
                <li className="dda-recurring-day-modal__summary-chip dda-recurring-day-modal__summary-chip--expense">
                  {t("pages.accounts.recurringCalendarDayExpense", { count: summary.expense })}
                </li>
              ) : null}
              {summary.transfer > 0 ? (
                <li className="dda-recurring-day-modal__summary-chip dda-recurring-day-modal__summary-chip--transfer">
                  {t("pages.accounts.recurringCalendarDayTransfer", { count: summary.transfer })}
                </li>
              ) : null}
            </ul>
          ) : null}

          {onDateDonationCount > 0 ? (
            <div className="dda-recurring-day-modal__total">
              <div className="min-w-0">
                <p className="dda-recurring-day-modal__total-label">
                  {t("pages.accounts.recurringCalendarDayDonationTotalLabel")}
                </p>
                <p className="dda-recurring-day-modal__total-count">
                  {t("pages.accounts.recurringCalendarDayDonationTotalCount", {
                    count: onDateDonationCount,
                  })}
                </p>
              </div>
              <p className="dda-recurring-day-modal__total-amount tabular-nums">
                +{formatPoolCurrency(onDateDonationTotal)}
              </p>
            </div>
          ) : null}

          {!items.length ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-gray-500">
              {t("pages.accounts.recurringEmpty")}
            </p>
          ) : (
            <>
              {onDateItems.length ? (
                <section className="dda-recurring-day-modal__section">
                  <h3 className="dda-recurring-day-modal__section-title">
                    {t("pages.accounts.recurringCalendarDayOnDate")}
                  </h3>
                  <ul className="dda-recurring-day-modal__list">
                    {onDateItems.map((item) => (
                      <ScheduleCard
                        key={`${item.schedule.id}-on-${dayYmd}`}
                        schedule={item.schedule}
                        dayYmd={dayYmd}
                        onDate
                        settled={item.settled}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onPayNow={onPayNow}
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {otherItems.length ? (
                <section className="dda-recurring-day-modal__section">
                  <h3 className="dda-recurring-day-modal__section-title">
                    {t("pages.accounts.recurringCalendarDayOther")}
                  </h3>
                  <ul className="dda-recurring-day-modal__list">
                    {otherItems.map((item) => (
                      <ScheduleCard
                        key={`${item.schedule.id}-other`}
                        schedule={item.schedule}
                        dayYmd={dayYmd}
                        onDate={false}
                        settled={false}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onPayNow={onPayNow}
                        t={t}
                        locale={locale}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
