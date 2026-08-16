import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Gift,
  LogIn,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { useLiveRelativeTime } from "../../context/EasternTimeContext";
import { findDadProfileById } from "../../lib/dadProfileStorage";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { getProfileActivityEvents } from "../../lib/profileActivity";

const PAGE_SIZE = 3;
const ACTIVITY_LIMIT = 24;

const ACTIVITY_ICONS = {
  register: UserPlus,
  login: LogIn,
  donation: CircleDollarSign,
  redemption: Gift,
  wallet_deposit: Wallet,
  profile_approve: UserCheck,
  profile_deny: UserCheck,
  referral: UserPlus,
  loan_request: Wallet,
  post: Activity,
  profile_edit: Activity,
};

const MONEY_TYPES = new Set(["donation", "redemption", "loan_request"]);

function ActivityTime({ occurredAt }) {
  const label = useLiveRelativeTime(occurredAt);
  return <span className="dda-home-activity__time">{label}</span>;
}

function resolveTargetPage(type, isAdmin) {
  if (type === "redemption") return isAdmin ? "accounts" : "members";
  if (type === "donation" || type === "loan_request") return isAdmin ? "admin" : "accounts";
  if (type === "register" || type === "profile_approve" || type === "profile_deny") {
    return isAdmin ? "members" : "dashboard";
  }
  if (type === "post") return "community";
  return isAdmin ? "accounts" : "accounts";
}

export default function HomeRecentActivityCard({ onNavigate, className = "" }) {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const [page, setPage] = useState(0);
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  const items = useMemo(() => {
    void dbRevision;
    const events = getProfileActivityEvents(isAdmin ? undefined : profile?.id, ACTIVITY_LIMIT);
    return events
      .filter((event) => {
        if (isAdmin) return true;
        return event.type !== "login" && event.type !== "logout";
      })
      .slice(0, ACTIVITY_LIMIT)
      .map((event) => {
        const actor = findDadProfileById(event.profileId);
        const name =
          actor?.fullName?.trim() ||
          actor?.displayName?.trim() ||
          actor?.username ||
          "";
        return {
          id: event.id,
          type: event.type,
          summary: event.summary,
          occurredAt: event.occurredAt,
          name: isAdmin ? name : "",
          targetPage: resolveTargetPage(event.type, isAdmin),
        };
      });
  }, [dbRevision, isAdmin, profile?.id]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    setPage(0);
  }, [items.length, dbRevision]);

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  const pageItems = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <section
      className={cn("dda-home-activity", className)}
      aria-label={t("pages.dashboard.recentActivityAria")}
    >
      <header className="dda-home-activity__head">
        <h2 className="dda-home-activity__title">{t("pages.dashboard.recentActivityTitle")}</h2>
      </header>

      {items.length === 0 ? (
        <p className="dda-home-activity__empty">{t("pages.dashboard.recentActivityEmpty")}</p>
      ) : (
        <>
          <ul className="dda-home-activity__list">
            {pageItems.map((item) => {
              const Icon = ACTIVITY_ICONS[item.type] ?? Activity;
              const money = MONEY_TYPES.has(item.type);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="dda-home-activity__item"
                    onClick={() => onNavigate?.(item.targetPage)}
                  >
                    <span
                      className={cn(
                        "dda-home-activity__item-icon",
                        money && "dda-home-activity__item-icon--money",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </span>
                    <span className="dda-home-activity__item-copy">
                      <span className="dda-home-activity__item-title">
                        {item.name ? `${item.name} · ${item.summary}` : item.summary}
                      </span>
                      <ActivityTime occurredAt={item.occurredAt} />
                    </span>
                    <ArrowUpRight
                      className="dda-home-activity__item-arrow h-3.5 w-3.5"
                      strokeWidth={2.25}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 ? (
            <div className="dda-home-activity__pager">
              <button
                type="button"
                className="dda-home-activity__pager-btn"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                aria-label={t("pages.accounts.previousPage")}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
              <span className="dda-home-activity__pager-label">
                {t("pages.accounts.pageOf", {
                  current: page + 1,
                  total: totalPages,
                })}
              </span>
              <button
                type="button"
                className="dda-home-activity__pager-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                aria-label={t("pages.accounts.nextPage")}
              >
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
