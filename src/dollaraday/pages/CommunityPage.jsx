import CommunityChat from "../components/community/CommunityChat";
import { useLocale } from "../i18n/LocaleContext";

function CommunityWelcomeCard() {
  const { t } = useLocale();

  return (
    <section className="dda-brand-card p-5 sm:p-6">
      <div className="dda-accent-bar mb-5" />
      <p className="dda-home-welcome text-center text-sm leading-relaxed text-gray-300 sm:text-[15px]">
        {t("pages.dashboard.welcomeLead")}{" "}
        <em>{t("pages.dashboard.welcomeEducates")}</em> {t("pages.dashboard.welcomeMid")}{" "}
        <em>{t("pages.dashboard.welcomeDiscipline")}</em> {t("pages.dashboard.welcomeWhile")}{" "}
        <em>{t("pages.dashboard.welcomeUniting")}</em> {t("pages.dashboard.welcomeTail")}{" "}
        <em>{t("pages.dashboard.welcomeOneDollar")}</em>
      </p>
    </section>
  );
}

export default function CommunityPage() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <CommunityWelcomeCard />
      <CommunityChat />
    </div>
  );
}
