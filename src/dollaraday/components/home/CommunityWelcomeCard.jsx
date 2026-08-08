import { useLocale } from "../../i18n/LocaleContext";

export default function CommunityWelcomeCard({ className = "" }) {
  const { t } = useLocale();

  return (
    <section className={`dda-brand-card p-5 sm:p-6 ${className}`.trim()}>
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
