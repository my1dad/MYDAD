import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  RefreshCw,
  X,
} from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { usePoolState } from "../../lib/poolState";
import { findStoredMemberByProfileId } from "../../lib/memberRegistry";
import { useLocale } from "../../i18n/LocaleContext";

const PRESETS_BY_FREQUENCY = {
  weekly: [
    { id: "p1", label: "$7", amount: 7 },
    { id: "p2", label: "$5", amount: 5 },
    { id: "p3", label: "$25", amount: 25 },
  ],
  monthly: [
    { id: "p1", label: "$31", amount: 31 },
    { id: "p2", label: "$140", amount: 140 },
    { id: "p3", label: "$700", amount: 700 },
  ],
};

function presetsForFrequency(frequency) {
  const tier = PRESETS_BY_FREQUENCY[frequency] ?? PRESETS_BY_FREQUENCY.weekly;
  return [...tier, { id: "custom", label: "custom", amount: null }];
}

function sanitizeMoneyInput(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function formatSeedAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "";
  return sanitizeMoneyInput(value.toFixed(2).replace(/\.00$/, ""));
}

/** Match a frequency preset, otherwise fall back to custom with the seeded amount. */
function resolveSeedSelection(frequency, initialAmount, startOnCustom) {
  const amount = Number(initialAmount);
  if (Number.isFinite(amount) && amount > 0) {
    const tier = PRESETS_BY_FREQUENCY[frequency] ?? PRESETS_BY_FREQUENCY.weekly;
    const match = tier.find((preset) => Math.abs(preset.amount - amount) < 0.001);
    if (match) {
      return { presetId: match.id, customAmount: "" };
    }
    return { presetId: "custom", customAmount: formatSeedAmount(amount) };
  }
  if (startOnCustom) {
    return { presetId: "custom", customAmount: "" };
  }
  return { presetId: "p1", customAmount: "" };
}

function getContributionAmount(presets, presetId, customAmount) {
  if (presetId === "custom") {
    const parsed = Number.parseFloat(customAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const preset = presets.find((item) => item.id === presetId);
  return preset?.amount ?? presets[0]?.amount ?? 0;
}

function formatContribution(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const FREQUENCY_COPY = {
  weekly: {
    recurringActive: "contribute.recurringActiveWeekly",
    nextDue: "contribute.nextDueWeekly",
  },
  monthly: {
    recurringActive: "contribute.recurringActiveMonthly",
    nextDue: "contribute.nextDueMonthly",
  },
  yearly: {
    recurringActive: "contribute.recurringActiveYearly",
    nextDue: "contribute.nextDueYearly",
  },
};

export default function ContributeOnboardingModal({
  open,
  onClose,
  onComplete,
  initialAmount = null,
  startOnCustom = false,
  contributionFrequency = "weekly",
}) {
  const { t } = useLocale();
  const { profile } = useDadAuth();
  const { currentMember } = usePoolState();

  const contributor = useMemo(() => {
    const stored = profile?.id ? findStoredMemberByProfileId(profile.id) : null;
    const streakDays = stored?.streak ?? currentMember?.streakDays ?? 0;
    const equityValue = Number(stored?.equity ?? currentMember?.equityValue) || 0;
    return { streakDays, equityValue };
  }, [profile, currentMember]);

  const [completed, setCompleted] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [recurringEnabled, setRecurringEnabled] = useState(true);
  const [donationPreset, setDonationPreset] = useState("p1");
  const [customAmount, setCustomAmount] = useState("");
  const [frequency, setFrequency] = useState(
    contributionFrequency === "monthly" ? "monthly" : "weekly",
  );

  const donationPresets = useMemo(() => presetsForFrequency(frequency), [frequency]);
  const frequencyCopy = FREQUENCY_COPY[frequency] ?? FREQUENCY_COPY.weekly;
  const contributionAmount = getContributionAmount(
    donationPresets,
    donationPreset,
    customAmount,
  );
  const formattedContribution = formatContribution(contributionAmount);
  const customAmountInvalid =
    donationPreset === "custom" && (contributionAmount <= 0 || customAmount.trim() === "");
  const canSubmit = !customAmountInvalid && contributionAmount > 0;

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    const nextFrequency = contributionFrequency === "monthly" ? "monthly" : "weekly";

    if (!open) {
      setCompleted(false);
      setReminderEnabled(true);
      setRecurringEnabled(true);
      setDonationPreset("p1");
      setCustomAmount("");
      setFrequency(nextFrequency);
      return;
    }

    setCompleted(false);
    setReminderEnabled(true);
    setRecurringEnabled(true);
    setFrequency(nextFrequency);

    const seed = resolveSeedSelection(nextFrequency, initialAmount, startOnCustom);
    setDonationPreset(seed.presetId);
    setCustomAmount(seed.customAmount);
  }, [open, initialAmount, startOnCustom, contributionFrequency]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setCompleted(true);
    onComplete?.({
      reminderEnabled: recurringEnabled ? reminderEnabled : false,
      recurringEnabled,
      amount: contributionAmount,
      frequency,
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("contribute.closeOnboarding")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribute-onboarding-title"
        className="dda-donate-sheet relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
              {t("contribute.sheetKicker")}
            </p>
            <h2 id="contribute-onboarding-title" className="mt-1 text-xl font-semibold text-white">
              {completed ? t("contribute.contributingToday") : t("contribute.sheetTitle")}
            </h2>
            {!completed ? (
              <p className="mt-1 text-sm text-gray-400">{t("contribute.sheetSub")}</p>
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

        <div className="dda-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {completed ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-dda-green/15 ring-1 ring-dda-green/30">
                <CheckCircle2 className="h-7 w-7 text-dda-green-light" strokeWidth={2.25} />
              </span>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-300">
                {t("contribute.contributeSuccess", {
                  amount: formattedContribution,
                  days: contributor.streakDays,
                })}
              </p>

              <div className="dda-donate-sheet__summary mt-6 w-full text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">{t("contribute.newEquity")}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">
                      $
                      {(contributor.equityValue + contributionAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{t("contribute.nextDue")}</p>
                    <p className="mt-1 text-sm font-medium text-gray-200">
                      {recurringEnabled ? t(frequencyCopy.nextDue) : t("contribute.oneTimeDue")}
                    </p>
                  </div>
                </div>
                {recurringEnabled ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-dda-green-light">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t(frequencyCopy.recurringActive, { amount: formattedContribution })}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="dda-btn-primary mt-6 w-full py-3 text-sm font-semibold"
              >
                {t("common.done")}
              </button>
            </div>
          ) : (
            <form
              className="dda-donate-sheet__form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <div className="dda-donate-sheet__amount-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("contribute.amountLabel")}
                </p>
                <p className="dda-donate-sheet__amount" aria-live="polite">
                  {formattedContribution}
                </p>

                <div className="dda-donate-sheet__presets" role="group" aria-label={t("contribute.donationAmount")}>
                  {donationPresets.map((preset) => {
                    const active = donationPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setDonationPreset(preset.id)}
                        className={cn(
                          "dda-donate-sheet__preset",
                          active && "dda-donate-sheet__preset--active",
                        )}
                      >
                        {preset.id === "custom" ? t("common.custom") : preset.label}
                      </button>
                    );
                  })}
                </div>

                {donationPreset === "custom" ? (
                  <div className="mt-3">
                    <label htmlFor="custom-contribution" className="sr-only">
                      {t("contribute.customAmount")}
                    </label>
                    <div className="dda-donate-sheet__custom-input">
                      <span aria-hidden="true">$</span>
                      <input
                        id="custom-contribution"
                        type="text"
                        inputMode="decimal"
                        value={customAmount}
                        onChange={(event) => setCustomAmount(sanitizeMoneyInput(event.target.value))}
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    {customAmountInvalid ? (
                      <p className="mt-1.5 text-xs text-red-400">{t("contribute.amountGreater")}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="dda-donate-sheet__options">
                <div className="dda-donate-sheet__row">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{t("contribute.recurringToggle")}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {recurringEnabled
                        ? t("contribute.recurringToggleOn")
                        : t("contribute.recurringToggleOff")}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recurringEnabled}
                    onClick={() => setRecurringEnabled((value) => !value)}
                    className={cn(
                      "dda-donate-sheet__switch",
                      recurringEnabled && "dda-donate-sheet__switch--on",
                    )}
                  >
                    <span className="dda-donate-sheet__switch-thumb" />
                  </button>
                </div>

                <div className="dda-donate-sheet__row">
                  <label htmlFor="contribution-frequency" className="min-w-0 text-sm font-medium text-white">
                    {t("contribute.frequencyLabel")}
                  </label>
                  <select
                    id="contribution-frequency"
                    value={frequency}
                    onChange={(event) =>
                      setFrequency(event.target.value === "monthly" ? "monthly" : "weekly")
                    }
                    disabled={!recurringEnabled}
                    className="dda-contribute-frequency-select"
                    aria-label={t("contribute.frequencyLabel")}
                  >
                    <option value="weekly">{t("contribute.weekly")}</option>
                    <option value="monthly">{t("contribute.monthly")}</option>
                  </select>
                </div>

                {recurringEnabled ? (
                  <label className="dda-donate-sheet__row dda-donate-sheet__row--check">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">
                        {t("contribute.remindMidnight")}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {t("contribute.streakNudge")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(event) => setReminderEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-black/30 text-dda-green focus:ring-dda-green/30"
                    />
                  </label>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  "mt-5 w-full py-3.5 text-sm font-semibold",
                  canSubmit ? "dda-btn-primary" : "cursor-not-allowed rounded-xl bg-dda-green/40 text-dda-ink/70",
                )}
              >
                {t("contribute.contributeToday", { amount: formattedContribution })}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
