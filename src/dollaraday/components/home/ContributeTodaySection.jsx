import { ChevronRight } from "lucide-react";
import { APPLE_PAY_LOGO_URL, APPLE_PAY_LEARN_URL, ZELLE_LOGO_URL, ZELLE_URL } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";

export default function ContributeTodaySection({
  onContributeWeekly,
  onContributeMonthly,
  onContributeYearly,
  onContributeOther,
  className,
}) {
  const { t } = useLocale();

  const presets = [
    {
      id: "weekly",
      amount: "$7",
      period: t("pages.dashboard.weeklyPeriod"),
      hint: t("pages.dashboard.weeklyHint"),
      onClick: onContributeWeekly,
    },
    {
      id: "monthly",
      amount: "$31",
      period: t("pages.dashboard.monthlyPeriod"),
      hint: t("pages.dashboard.monthlyHint"),
      onClick: onContributeMonthly,
    },
    {
      id: "yearly",
      amount: "$365",
      period: t("pages.dashboard.yearlyPeriod"),
      hint: t("pages.dashboard.yearlyHint"),
      onClick: onContributeYearly,
    },
  ];

  return (
    <section className={cn("dda-contribute-panel", className)} aria-labelledby="contribute-today-heading">
      <div className="dda-accent-bar" />

      <div className="dda-contribute-panel__body">
        <header className="dda-contribute-panel__header">
          <p className="dda-text-kicker">{t("pages.dashboard.contributeKicker")}</p>
          <h2 id="contribute-today-heading" className="dda-contribute-panel__title">
            {t("pages.dashboard.contributeToday")}
          </h2>
          <p className="dda-contribute-panel__subtitle">{t("pages.dashboard.contributeHint")}</p>
        </header>

        <div className="dda-contribute-panel__presets" role="group" aria-label={t("pages.dashboard.contributeToday")}>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={preset.onClick}
              className={cn("dda-contribute-preset", `dda-contribute-preset--${preset.id}`)}
            >
              <span className="dda-contribute-preset__glass" aria-hidden="true" />
              <span className="dda-contribute-preset__amount">{preset.amount}</span>
              <span className="dda-contribute-preset__period">{preset.period}</span>
              <span className="dda-contribute-preset__hint">{preset.hint}</span>
            </button>
          ))}

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

        <div className="dda-contribute-panel__payments" aria-label={t("pages.dashboard.paymentMethods")}>
          <span className="dda-contribute-panel__pay-label">{t("pages.dashboard.payWith")}</span>
          <div className="dda-home-payment-logos dda-home-payment-logos--inline">
            <a
              href={APPLE_PAY_LEARN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="dda-home-payment-logo-link"
              aria-label="Learn about Apple Pay"
            >
              <img
                src={APPLE_PAY_LOGO_URL}
                alt=""
                className="dda-home-payment-logo dda-home-payment-logo--apple"
                draggable={false}
              />
            </a>
            <a
              href={ZELLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="dda-home-payment-logo-link"
              aria-label="Visit Zelle"
            >
              <img
                src={ZELLE_LOGO_URL}
                alt=""
                className="dda-home-payment-logo dda-home-payment-logo--zelle"
                draggable={false}
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
