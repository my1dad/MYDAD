import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import HeaderToolbar from "../layout/HeaderToolbar";
import PoolDigitalDisplay from "./PoolDigitalDisplay.jsx";
import ContributeTodaySection from "./ContributeTodaySection.jsx";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";

function getProfileFullName(profile) {
  if (!profile) return "";
  return profile.fullName?.trim() || profile.displayName?.trim() || "";
}

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
  const { profile } = useDadAuth();
  const userFullName = getProfileFullName(profile);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-2 sm:max-w-xl sm:gap-7">
      <header className="dda-home-hero">
        <div className="dda-accent-bar" />
        <div className="dda-home-hero__inner">
          <div className="dda-home-hero__top">
            {userFullName ? (
              <p className="dda-home-greeting">
                <span className="dda-home-greeting__label">{t("pages.dashboard.welcomeLabel")}</span>{" "}
                <span className="dda-home-greeting__name">{userFullName}</span>
              </p>
            ) : (
              <span className="dda-home-greeting dda-home-greeting--empty" aria-hidden="true" />
            )}
            <HeaderToolbar languageClassName="dda-home-hero__lang shrink-0" />
          </div>

          <div className="dda-home-hero__brand">
            <img
              src={DOLLARADAY_LOGO_URL}
              alt=""
              draggable={false}
              className="dda-home-hero__logo"
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
          </div>
        </div>
      </header>

      <section className="dda-brand-card p-5 sm:p-6">
        <div className="dda-accent-bar mb-5" />
        <WelcomeCopy />
      </section>

      <ContributeTodaySection
        onContributeWeekly={onContributeWeekly}
        onContributeMonthly={onContributeMonthly}
        onContributeYearly={onContributeYearly}
        onContributeOther={onContributeOther}
      />

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
