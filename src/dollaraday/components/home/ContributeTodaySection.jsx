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

  const contributeOptions = [
    { label: t("pages.dashboard.weekly"), onClick: onContributeWeekly },
    { label: t("pages.dashboard.monthly"), onClick: onContributeMonthly },
    { label: t("pages.dashboard.yearly"), onClick: onContributeYearly },
    { label: t("pages.dashboard.otherAmount"), onClick: onContributeOther, showPayments: true },
  ];

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className="text-center text-base font-extrabold tracking-[0.12em] text-white sm:text-lg">
        {t("pages.dashboard.contributeToday")}
      </h2>

      <div className="space-y-2">
        {contributeOptions.map((option) => (
          <div key={option.label}>
            <button type="button" onClick={option.onClick} className="dda-home-contribute-btn">
              {option.label}
            </button>
            {option.showPayments ? (
              <div className="dda-home-payment-logos" aria-label={t("pages.dashboard.paymentMethods")}>
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
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
