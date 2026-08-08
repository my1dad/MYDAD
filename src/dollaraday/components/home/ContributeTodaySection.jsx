import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { APPLE_PAY_LOGO_URL, ZELLE_LOGO_URL } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";
import ApplePaySmsModal from "./ApplePaySmsModal.jsx";
import ZellePayModal from "./ZellePayModal.jsx";

function PaymentMethods() {
  const { t } = useLocale();
  const [applePayOpen, setApplePayOpen] = useState(false);
  const [zelleOpen, setZelleOpen] = useState(false);

  return (
    <>
      <div className="dda-contribute-panel__payments" aria-label={t("pages.dashboard.paymentMethods")}>
        <div className="dda-home-payment-logos dda-home-payment-logos--inline">
          <button
            type="button"
            className="dda-home-payment-logo-link"
            aria-label={t("contribute.applePaySmsOpen")}
            onClick={() => setApplePayOpen(true)}
          >
            <img
              src={APPLE_PAY_LOGO_URL}
              alt=""
              className="dda-home-payment-logo dda-home-payment-logo--apple"
              draggable={false}
            />
          </button>
          <span className="dda-contribute-panel__pay-label">{t("pages.dashboard.payWith")}</span>
          <button
            type="button"
            className="dda-home-payment-logo-link"
            aria-label={t("contribute.zellePayOpen")}
            onClick={() => setZelleOpen(true)}
          >
            <img
              src={ZELLE_LOGO_URL}
              alt=""
              className="dda-home-payment-logo dda-home-payment-logo--zelle"
              draggable={false}
            />
          </button>
        </div>
      </div>

      <ApplePaySmsModal open={applePayOpen} onClose={() => setApplePayOpen(false)} />
      <ZellePayModal open={zelleOpen} onClose={() => setZelleOpen(false)} />
    </>
  );
}

export default function ContributeTodaySection({
  onContributeWeekly,
  onContributeMonthly,
  onContributeYearly,
  onContributeOther,
  showPanel = true,
  className,
}) {
  const { t } = useLocale();

  const presets = [
    {
      id: "weekly",
      amount: "$7",
      period: t("pages.dashboard.weeklyPeriod"),
      hint: t("pages.dashboard.weeklyHint"),
      rate: t("pages.dashboard.contributeRateChip"),
      onClick: onContributeWeekly,
    },
    {
      id: "monthly",
      amount: "$31",
      period: t("pages.dashboard.monthlyPeriod"),
      hint: t("pages.dashboard.monthlyHint"),
      rate: t("pages.dashboard.contributeRateChip"),
      onClick: onContributeMonthly,
    },
    {
      id: "yearly",
      amount: "$365",
      period: t("pages.dashboard.yearlyPeriod"),
      hint: t("pages.dashboard.yearlyHint"),
      rate: t("pages.dashboard.contributeRateChip"),
      onClick: onContributeYearly,
    },
  ];

  if (!showPanel) {
    return (
      <section
        className={cn("dda-contribute-section", className)}
        aria-label={t("pages.dashboard.paymentMethods")}
      >
        <PaymentMethods />
      </section>
    );
  }

  return (
    <section
      className={cn("dda-contribute-section", className)}
      aria-labelledby="contribute-today-heading"
    >
      <PaymentMethods />

      <div className="dda-contribute-panel">
        <div className="dda-accent-bar" />
        <div className="dda-contribute-panel__glow" aria-hidden="true" />

        <div className="dda-contribute-panel__body">
          <header className="dda-contribute-panel__header">
            <div className="dda-contribute-panel__eyebrow">
              <p className="dda-text-kicker">{t("pages.dashboard.contributeKicker")}</p>
              <span className="dda-contribute-panel__rate">
                <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                {t("pages.dashboard.contributeRateChip")}
              </span>
            </div>
            <h2 id="contribute-today-heading" className="dda-contribute-panel__title">
              {t("pages.dashboard.contributeToday")}
            </h2>
            <p className="dda-contribute-panel__subtitle">{t("pages.dashboard.contributeHint")}</p>
          </header>

          <div className="dda-contribute-panel__actions">
            <div
              className="dda-contribute-panel__presets"
              role="group"
              aria-label={t("pages.dashboard.contributeToday")}
            >
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={preset.onClick}
                  className={cn("dda-contribute-preset", `dda-contribute-preset--${preset.id}`)}
                >
                  <span className="dda-contribute-preset__glass" aria-hidden="true" />
                  <span className="dda-contribute-preset__period">{preset.period}</span>
                  <span className="dda-contribute-preset__amount">{preset.amount}</span>
                  <span className="dda-contribute-preset__hint">{preset.hint}</span>
                  <span className="dda-contribute-preset__rate">{preset.rate}</span>
                </button>
              ))}
            </div>

            <button type="button" onClick={onContributeOther} className="dda-contribute-custom">
              <span className="dda-contribute-custom__mark" aria-hidden="true">
                $
              </span>
              <span className="dda-contribute-custom__copy">
                <span className="dda-contribute-custom__label">{t("pages.dashboard.otherAmount")}</span>
                <span className="dda-contribute-custom__action">{t("pages.dashboard.otherAmountAction")}</span>
              </span>
              <ChevronRight className="dda-contribute-custom__chevron" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
