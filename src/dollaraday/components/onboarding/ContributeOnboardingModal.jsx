import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { usePoolState } from "../../lib/poolState";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";

const donationPresets = [
  { id: "1", label: "$1", amount: 1 },
  { id: "5", label: "$5", amount: 5 },
  { id: "10", label: "$10", amount: 10 },
  { id: "custom", label: "custom", amount: null },
];

function sanitizeMoneyInput(value) {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function getContributionAmount(presetId, customAmount) {
  if (presetId === "custom") {
    const parsed = Number.parseFloat(customAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const preset = donationPresets.find((item) => item.id === presetId);
  return preset?.amount ?? 1;
}

function formatContribution(amount) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ContributeOnboardingModal({ open, onClose, onComplete }) {
  const { t } = useLocale();
  const { translateTier } = useLocalizedData();
  const { currentMember } = usePoolState();

  const steps = [
    { id: "welcome", title: t("contribute.welcomeTitle"), description: t("contribute.welcomeDesc") },
    { id: "how-it-works", title: t("contribute.howTitle"), description: t("contribute.howDesc") },
    { id: "confirm", title: t("contribute.confirmTitle"), description: t("contribute.confirmDesc") },
  ];

  const howItWorks = [
    { icon: CircleDollarSign, title: t("contribute.dailyTitle"), text: t("contribute.dailyText"), accent: "#10b981" },
    { icon: Lock, title: t("contribute.escrowTitle"), text: t("contribute.escrowText"), accent: "#2563eb" },
    { icon: TrendingUp, title: t("contribute.equityTitle"), text: t("contribute.equityText"), accent: "#eab308" },
  ];
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [recurringEnabled, setRecurringEnabled] = useState(true);
  const [donationPreset, setDonationPreset] = useState("1");
  const [customAmount, setCustomAmount] = useState("");

  const contributionAmount = getContributionAmount(donationPreset, customAmount);
  const formattedContribution = formatContribution(contributionAmount);
  const customAmountInvalid =
    donationPreset === "custom" && (contributionAmount <= 0 || customAmount.trim() === "");

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
    if (!open) {
      setStep(0);
      setCompleted(false);
      setReminderEnabled(true);
      setRecurringEnabled(true);
      setDonationPreset("1");
      setCustomAmount("");
    }
  }, [open]);

  if (!open) return null;

  const isLastStep = step === steps.length - 1;
  const progress = completed ? 100 : ((step + 1) / steps.length) * 100;

  const handleNext = () => {
    if (isLastStep) {
      if (customAmountInvalid) return;
      setCompleted(true);
      onComplete?.({ reminderEnabled, recurringEnabled, amount: contributionAmount });
      return;
    }
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (completed) return;
    setStep((current) => Math.max(0, current - 1));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("contribute.closeOnboarding")}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribute-onboarding-title"
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#071013] shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400" />

        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
              {t("contribute.dailyContribution")}
            </p>
            <p className="text-xs text-gray-500">
              {t("common.stepOf", {
                current: completed ? steps.length : step + 1,
                total: steps.length,
              })}
            </p>
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

        <div className="px-5 pt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="dda-scroll overflow-y-auto px-5 py-5">
          {completed ? (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" strokeWidth={2.25} />
              </span>
              <h2 id="contribute-onboarding-title" className="mt-5 text-xl font-bold text-white">
                {t("contribute.contributingToday")}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-400">
                {t("contribute.contributeSuccess", {
                  amount: formattedContribution,
                  days: currentMember.streakDays,
                })}
              </p>

              <div className="dda-glass mt-6 w-full rounded-2xl p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500">{t("contribute.newEquity")}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-white">
                      ${(currentMember.equityValue + contributionAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{t("contribute.nextDue")}</p>
                    <p className="mt-1 text-sm font-medium text-gray-200">
                      {recurringEnabled ? t("contribute.tomorrowDue") : t("contribute.oneTimeDue")}
                    </p>
                  </div>
                </div>
                {recurringEnabled ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t("contribute.recurringActive", { amount: formattedContribution })}
                  </p>
                ) : null}
              </div>
            </div>
          ) : step === 0 ? (
            <div>
              <div className="flex justify-center">
                <img
                  src={DOLLARADAY_LOGO_URL}
                  alt=""
                  draggable={false}
                  className="h-20 w-auto max-w-[9rem] object-contain"
                />
              </div>
              <h2 id="contribute-onboarding-title" className="mt-5 text-xl font-bold text-white">
                {steps[step].title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{steps[step].description}</p>

              <div className="dda-glass mt-5 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-bold text-emerald-400 ring-1 ring-emerald-400/30">
                    {currentMember.avatarInitials}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{currentMember.name}</p>
                    <p className="text-xs text-gray-500">
                      {translateTier(currentMember.tier)} · {t("contribute.dayStreak", { days: currentMember.streakDays })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : step === 1 ? (
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h2 id="contribute-onboarding-title" className="text-xl font-bold text-white">
                  {steps[step].title}
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{steps[step].description}</p>

              <ul className="mt-5 space-y-3">
                {howItWorks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.title} className="dda-glass-btn flex gap-3 rounded-2xl p-4">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
                        style={{
                          backgroundColor: `${item.accent}18`,
                          color: item.accent,
                          boxShadow: `inset 0 0 0 1px ${item.accent}33`,
                        }}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-400">{item.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div>
              <h2 id="contribute-onboarding-title" className="text-xl font-bold text-white">
                {t("contribute.setupToday")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{steps[step].description}</p>

              <div className="dda-glass mt-5 overflow-hidden rounded-2xl">
                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {t("contribute.todaysContribution")}
                  </p>
                </div>
                <div className="space-y-4 p-4">
                  <div>
                    <p className="mb-2 text-sm text-gray-400">{t("contribute.donationAmount")}</p>
                    <div className="grid grid-cols-4 gap-1 rounded-lg bg-black/30 p-1">
                      {donationPresets.map((preset) => {
                        const active = donationPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setDonationPreset(preset.id)}
                            className={cn(
                              "rounded-md px-2 py-2 text-xs font-semibold transition sm:text-sm",
                              active
                                ? "bg-emerald-400/15 text-emerald-400 shadow-sm"
                                : "text-gray-400 hover:text-white"
                            )}
                          >
                            {preset.id === "custom" ? t("common.custom") : preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {donationPreset === "custom" ? (
                    <div>
                      <label htmlFor="custom-contribution" className="mb-1.5 block text-sm text-gray-400">
                        {t("contribute.customAmount")}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                          $
                        </span>
                        <input
                          id="custom-contribution"
                          type="text"
                          inputMode="decimal"
                          value={customAmount}
                          onChange={(event) => setCustomAmount(sanitizeMoneyInput(event.target.value))}
                          placeholder="0.00"
                          className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-8 pr-4 text-sm font-semibold tabular-nums text-white placeholder:text-gray-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      {customAmountInvalid ? (
                        <p className="mt-1.5 text-xs text-red-400">{t("contribute.amountGreater")}</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-400">{t("contribute.amountLabel")}</p>
                      <p className="mt-1 text-3xl font-bold tabular-nums text-white">
                        {formattedContribution}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                      {t("contribute.daily")}
                    </span>
                  </div>

                  <div className="dda-panel rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 shrink-0 text-emerald-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{t("contribute.mockWallet")}</p>
                        <p className="text-xs text-gray-500">{t("contribute.demoPayment")}</p>
                      </div>
                    </div>
                  </div>

                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                      recurringEnabled
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-white/10 bg-black/20"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={recurringEnabled}
                      onChange={(event) => setRecurringEnabled(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-500 focus:ring-emerald-500/30"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="text-sm font-medium text-white">
                          {t("contribute.recurringTitle")}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {t("contribute.recurringDesc", { amount: formattedContribution })}
                      </span>
                    </span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(event) => setReminderEnabled(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-emerald-500 focus:ring-emerald-500/30"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">
                        {t("contribute.remindMidnight")}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {t("contribute.streakNudge")}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
          {!completed && step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
            >
              {t("common.back")}
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={completed ? onClose : handleNext}
            disabled={!completed && isLastStep && customAmountInvalid}
            className={cn(
              "ml-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              !completed && isLastStep && customAmountInvalid
                ? "cursor-not-allowed bg-emerald-500/40 text-[#071013]/70"
                : "bg-emerald-500 text-[#071013] hover:bg-emerald-400"
            )}
          >
            {completed
              ? t("common.done")
              : isLastStep
                ? t("contribute.contributeToday", { amount: formattedContribution })
                : t("common.continue")}
            {!completed && !isLastStep ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
