import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";
import ContributeTodaySection from "./ContributeTodaySection.jsx";
import HomeAlertsWidget from "./HomeAlertsWidget.jsx";

/**
 * Desktop-only: Apple Pay / Zelle + Alerts in one card.
 * Mobile keeps separate contribute / alerts placements elsewhere.
 */
export default function HomeDesktopPayAlertsRail({ onNavigate, className, memberTone = false }) {
  const { t } = useLocale();

  return (
    <section
      className={cn(
        "dda-home-pay-alerts",
        memberTone && "dda-home-pay-alerts--member",
        className,
      )}
      aria-label={t("pages.dashboard.deskPayAlertsAria")}
    >
      <div className="dda-accent-bar" />
      <div className="dda-home-pay-alerts__grid">
        <div className="dda-home-pay-alerts__pay">
          <p className="dda-text-kicker">{t("pages.dashboard.payWith")}</p>
          <ContributeTodaySection bare className="dda-home-pay-alerts__contribute" />
        </div>
        <HomeAlertsWidget
          embedded
          className="dda-home-pay-alerts__alerts"
          onNavigate={onNavigate}
        />
      </div>
    </section>
  );
}
