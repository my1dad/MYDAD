import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowDown, CheckCircle2, Gift } from "lucide-react";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { formatEasternShortDate } from "../../lib/dateTime";
import { useAdminMemberRecords } from "../../lib/profileRegistry";
import {
  getAdminLiquidityAvailable,
  resolveMemberProfileId,
  useMemberAccounts,
} from "../../lib/memberAccounts";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { listRedemptionRecords, saveAdminRedemption } from "../../lib/redemptions";

const TX_PAGE_SIZE = 5;
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

export default function RedemptionsCard({ defaultCollapsed = true, expandAsOverlay = false }) {
  const { t, locale } = useLocale();
  const fromProfileId = resolveMemberProfileId();
  const savedMembers = useAdminMemberRecords();
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  const recipientOptions = useMemo(() => {
    return savedMembers
      .filter((member) => {
        const id = member.profileId ?? member.id;
        if (!id || id === fromProfileId) return false;
        if (member.username?.trim().toLowerCase() === "admin") return false;
        if (member.status === "declined" || member.status === "denied") return false;
        return true;
      })
      .map((member) => ({
        id: member.profileId ?? member.id,
        label: member.name || member.username || "Member",
        handle: member.handle || (member.username ? `@${member.username}` : ""),
        status: member.status,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [savedMembers, fromProfileId]);

  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [txPage, setTxPage] = useState(0);

  const redemptionRows = useMemo(() => {
    void dbRevision;
    return listRedemptionRecords();
  }, [dbRevision]);

  const txTotalPages = Math.max(1, Math.ceil(redemptionRows.length / TX_PAGE_SIZE));
  const pagedRedemptions = redemptionRows.slice(
    txPage * TX_PAGE_SIZE,
    txPage * TX_PAGE_SIZE + TX_PAGE_SIZE,
  );

  useEffect(() => {
    setTxPage(0);
  }, [redemptionRows.length]);

  useEffect(() => {
    if (txPage > txTotalPages - 1) setTxPage(Math.max(0, txTotalPages - 1));
  }, [txPage, txTotalPages]);

  useEffect(() => {
    if (!recipientOptions.length) {
      setSelectedProfileId("");
      return;
    }
    if (!recipientOptions.some((option) => option.id === selectedProfileId)) {
      setSelectedProfileId(recipientOptions[0].id);
    }
  }, [recipientOptions, selectedProfileId]);

  const recipientLedger = useMemberAccounts(selectedProfileId || fromProfileId);
  const selectedRecipient = recipientOptions.find((option) => option.id === selectedProfileId);
  const liquidityAvailable = useMemo(() => {
    void dbRevision;
    return getAdminLiquidityAvailable();
  }, [dbRevision]);
  const recipientBalance =
    selectedProfileId && selectedProfileId !== fromProfileId
      ? (Number(recipientLedger.checkingBalance) || 0) +
        (Number(recipientLedger.escrowBalance) || 0)
      : 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const parsed = parseAmount(amount);
    if (parsed <= 0) {
      setError(t("pages.accounts.amountRequired"));
      return;
    }
    if (!selectedProfileId) {
      setError(t("pages.accounts.redemptionProfileRequired"));
      return;
    }

    const recipientLabel = selectedRecipient?.label ?? "Member";
    const redemptionMemo =
      memo.trim() ||
      t("pages.accounts.redemptionDefaultMemo", {
        profile: recipientLabel,
      });

    const result = saveAdminRedemption({
      fromProfileId,
      toProfileId: selectedProfileId,
      amount: parsed,
      memo: redemptionMemo,
      memberName: recipientLabel,
      handle: selectedRecipient?.handle,
    });
    if (!result.ok) {
      setError(t("pages.accounts.redemptionFailed"));
      return;
    }

    setAmount("");
    setMemo("");
    setTxPage(0);
    setStatus(
      t("pages.accounts.redemptionSuccess", {
        amount: formatPoolCurrency(parsed),
        profile: recipientLabel,
      }),
    );
  };

  return (
    <DashboardCard
      title={t("pages.accounts.redemptionsTitle")}
      subtitle={t("pages.accounts.redemptionsSub")}
      collapsible
      defaultCollapsed={defaultCollapsed}
      expandAsOverlay={expandAsOverlay}
      collapseAriaLabel={t("pages.accounts.collapseRedemptions")}
      expandAriaLabel={t("pages.accounts.expandRedemptions")}
      collapsedPreview={
        redemptionRows.length ? (
          <ul className="dda-bank-ledger">
            {redemptionRows.slice(0, COLLAPSED_PREVIEW_SIZE).map((row) => (
              <li key={row.id} className="dda-bank-ledger__row">
                <span className="dda-bank-ledger__icon">
                  <Gift className="h-3.5 w-3.5" strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight text-white">
                    {row.memberName}
                    {row.handle ? ` (${row.handle})` : ""}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-tight text-gray-500">
                    {row.memo?.trim() || t("pages.accounts.redemptionTxDefaultMemo")}
                    {" · "}
                    {formatEasternShortDate(row.redeemedAt, locale === "es" ? "es" : "en")}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-dda-gold">
                  −{formatPoolCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="dda-card-collapsed-preview__empty">
            {t("pages.accounts.overviewNoRedemptions")}
          </p>
        )
      }
    >
      <div className="space-y-5">
        {recipientOptions.length ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="dda-bank-transfer-route">
              <div className="dda-bank-transfer-route__node">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  {t("pages.accounts.from")}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {t("pages.dashboard.liquidityTitle")}
                </p>
                <p className="text-xs tabular-nums text-gray-400">
                  {formatPoolCurrency(liquidityAvailable)}
                </p>
              </div>

              <span className="dda-bank-transfer-route__divider" aria-hidden="true">
                <ArrowDown className="h-4 w-4" />
              </span>

              <div className="dda-bank-transfer-route__node">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  {t("pages.accounts.to")}
                </p>
                <label htmlFor="redemption-profile" className="sr-only">
                  {t("pages.accounts.redemptionProfile")}
                </label>
                <select
                  id="redemption-profile"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                  className="dda-bank-transfer-route__select w-full"
                >
                  {recipientOptions.map((option) => (
                    <option key={option.id} value={option.id} className="bg-dda-bg text-white">
                      {option.label}
                      {option.handle ? ` (${option.handle})` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs tabular-nums text-gray-400">
                  {t("pages.accounts.redemptionRecipientBalance", {
                    amount: formatPoolCurrency(recipientBalance),
                  })}
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="redemption-amount" className="mb-1.5 block text-sm text-gray-400">
                {t("pages.accounts.amount")}
              </label>
              <div className="dda-bank-amount-input">
                <input
                  id="redemption-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => handleAmountChange(event.target.value, setAmount)}
                  placeholder="$0.00"
                  className="w-full bg-transparent text-2xl font-bold tabular-nums text-white outline-none placeholder:text-gray-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="redemption-memo" className="mb-1.5 block text-sm text-gray-400">
                {t("pages.accounts.memo")}
              </label>
              <input
                id="redemption-memo"
                type="text"
                value={memo}
                onChange={(event) => setMemo(event.target.value)}
                placeholder={t("pages.accounts.redemptionMemoPlaceholder")}
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

            <button
              type="submit"
              className="dda-btn-primary inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold"
            >
              <Gift className="h-4 w-4" />
              {t("pages.accounts.confirmRedemption")}
            </button>
          </form>
        ) : (
          <div className="dda-panel rounded-xl p-6 text-center text-sm text-gray-500">
            {t("pages.accounts.redemptionsEmpty")}
          </div>
        )}

        <div className="dda-redemption-tx">
          <div className="dda-redemption-tx__head">
            <p className="dda-redemption-tx__title">{t("pages.accounts.redemptionTxTitle")}</p>
            <p className="dda-redemption-tx__count">
              {redemptionRows.length > 0
                ? t("pages.accounts.redemptionTxCount", { count: redemptionRows.length })
                : t("pages.accounts.overviewNoRedemptions")}
            </p>
          </div>

          {redemptionRows.length ? (
            <>
              <ul className="dda-bank-ledger">
                {pagedRedemptions.map((row) => (
                  <li key={row.id} className="dda-bank-ledger__row">
                    <span className="dda-bank-ledger__icon">
                      <Gift className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-tight text-white">
                        {row.memberName}
                        {row.handle ? ` (${row.handle})` : ""}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-tight text-gray-500">
                        {row.memo?.trim() || t("pages.accounts.redemptionTxDefaultMemo")}
                        {" · "}
                        {formatEasternShortDate(row.redeemedAt, locale === "es" ? "es" : "en")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-dda-gold">
                      −{formatPoolCurrency(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>

              {txTotalPages > 1 ? (
                <div className="dda-redemption-tx__pager">
                  <button
                    type="button"
                    className="dda-redemption-tx__pager-btn"
                    disabled={txPage === 0}
                    onClick={() => setTxPage((current) => Math.max(0, current - 1))}
                  >
                    {t("pages.accounts.previousPage")}
                  </button>
                  <span className="dda-redemption-tx__pager-label">
                    {t("pages.accounts.pageOf", {
                      current: txPage + 1,
                      total: txTotalPages,
                    })}
                  </span>
                  <button
                    type="button"
                    className="dda-redemption-tx__pager-btn"
                    disabled={txPage >= txTotalPages - 1}
                    onClick={() => setTxPage((current) => Math.min(txTotalPages - 1, current + 1))}
                  >
                    {t("pages.accounts.nextPage")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </DashboardCard>
  );
}
