import { useEffect, useMemo, useState } from "react";
import { ArrowDown, CheckCircle2, Gift } from "lucide-react";
import DashboardCard from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { getDadProfiles } from "../../lib/dadProfileStorage";
import { findStoredMemberByProfileId } from "../../lib/memberRegistry";
import {
  redeemToMemberProfile,
  resolveMemberProfileId,
  useMemberAccounts,
} from "../../lib/memberAccounts";

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

export default function RedemptionsCard() {
  const { t } = useLocale();
  const fromProfileId = resolveMemberProfileId();
  const senderLedger = useMemberAccounts(fromProfileId);

  const recipientOptions = useMemo(() => {
    return getDadProfiles()
      .filter((profile) => profile.id !== fromProfileId)
      .map((profile) => {
        const member = findStoredMemberByProfileId(profile.id);
        return {
          id: profile.id,
          label: profile.displayName,
          handle: member?.handle ?? `@${profile.username}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fromProfileId]);

  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

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
  const senderBalance = senderLedger.checkingBalance;
  const recipientBalance =
    selectedProfileId && selectedProfileId !== fromProfileId
      ? recipientLedger.checkingBalance
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

    const ok = redeemToMemberProfile(fromProfileId, selectedProfileId, parsed, redemptionMemo);
    if (!ok) {
      setError(t("pages.accounts.redemptionFailed"));
      return;
    }

    setAmount("");
    setMemo("");
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
      defaultCollapsed
      collapseAriaLabel={t("pages.accounts.collapseRedemptions")}
      expandAriaLabel={t("pages.accounts.expandRedemptions")}
    >
      {recipientOptions.length ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="dda-bank-transfer-route">
            <div className="dda-bank-transfer-route__node">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                {t("pages.accounts.from")}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {t("pages.accounts.checkingTab")}
              </p>
              <p className="text-xs tabular-nums text-gray-400">
                {formatPoolCurrency(senderBalance)}
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
                className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none"
              >
                {recipientOptions.map((option) => (
                  <option key={option.id} value={option.id} className="bg-dda-bg text-white">
                    {option.label} ({option.handle})
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
    </DashboardCard>
  );
}
