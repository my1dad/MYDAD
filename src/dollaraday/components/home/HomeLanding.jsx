import { DOLLARADAY_LOGO_URL, APPLE_PAY_LOGO_URL, APPLE_PAY_LEARN_URL, ZELLE_LOGO_URL, ZELLE_URL } from "@/lib/assetUrl";
import LanguageToggle from "../layout/LanguageToggle";
import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import { useLocale } from "../../i18n/LocaleContext";

function WelcomeCopy() {
  const { t } = useLocale();

  return (
    <p className="dda-home-welcome text-center text-sm leading-relaxed text-gray-300 sm:text-[15px]">
      {t("pages.dashboard.welcomeLead")}{" "}
      <em>{t("pages.dashboard.welcomeEducates")}</em> {t("pages.dashboard.welcomeMid")}{" "}
      <em>{t("pages.dashboard.welcomeDiscipline")}</em> {t("pages.dashboard.welcomeWhile")}{" "}
      <em>{t("pages.dashboard.welcomeUniting")}</em> {t("pages.dashboard.welcomeTail")}{" "}
      <em>{t("pages.dashboard.welcomeOneDollar")}</em>
    </p>
  );
}

export default function HomeLanding({
  poolTotal,
  poolMemberCount,
  poolDailyInflow,
  poolYtdGrowthPct,
  onContributeWeekly,
  onContributeMonthly,
  onContributeYearly,
  onContributeOther,
  onPoolClick,
}) {
  const { t } = useLocale();

  const contributeOptions = [
    { label: t("pages.dashboard.weekly"), onClick: onContributeWeekly },
    { label: t("pages.dashboard.monthly"), onClick: onContributeMonthly },
    { label: t("pages.dashboard.yearly"), onClick: onContributeYearly },
    { label: t("pages.dashboard.otherAmount"), onClick: onContributeOther, showPayments: true },
  ];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-2 sm:max-w-xl sm:gap-7">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>

      <header className="flex items-center gap-4 sm:gap-5">
        <img
          src={DOLLARADAY_LOGO_URL}
          alt=""
          draggable={false}
          className="h-28 w-auto shrink-0 object-contain sm:h-32"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold leading-none tracking-tight text-white sm:text-2xl">
            {t("pages.dashboard.brandLine1")}
          </p>
          <hr className="dda-home-brand-line" />
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-dda-green-light sm:text-base">
            {t("pages.dashboard.brandLine2")}
          </p>
        </div>
      </header>

      <section className="dda-brand-card p-5 sm:p-6">
        <div className="dda-accent-bar mb-5" />
        <WelcomeCopy />
      </section>

      <section className="space-y-3">
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

      <PoolDigitalDisplay
        amount={poolTotal}
        memberCount={poolMemberCount}
        dailyInflow={poolDailyInflow}
        ytdGrowthPct={poolYtdGrowthPct}
        onClick={onPoolClick}
      />
    </div>
  );
}
