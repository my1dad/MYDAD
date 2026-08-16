import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MemberAvatar, Badge } from "../layout/DashboardCard";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";
import { getMemberInitials } from "../../lib/memberDetails";
import { useCommunityLeadershipEntries } from "../../lib/communityLeadership";

const PAGE_SIZE = 10;

function statusBadgeVariant(status) {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "declined") return "danger";
  return "default";
}

export default function CommunityLeadershipCard() {
  const { t } = useLocale();
  const { translateStatus } = useLocalizedData();
  const leaders = useCommunityLeadershipEntries();
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(leaders.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const pageEntries = useMemo(() => {
    const start = page * PAGE_SIZE;
    return leaders.slice(start, start + PAGE_SIZE);
  }, [leaders, page]);

  const rangeStart = leaders.length ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(leaders.length, (page + 1) * PAGE_SIZE);

  return (
    <section
      className="dda-leadership"
      aria-label={t("pages.community.leadershipTitle")}
    >
      <div className="dda-accent-bar" />
      <div className="dda-leadership__inner">
        <div className="dda-leadership__head">
          <div className="dda-leadership__kicker">
            <Trophy className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
            <p>{t("pages.community.leadershipKicker")}</p>
          </div>
          <p className="dda-leadership__subtitle">
            {t("pages.community.leadershipSubtitle", { count: leaders.length })}
          </p>
        </div>

        {leaders.length ? (
          <>
            <ol className="dda-leadership__list" start={rangeStart}>
              {pageEntries.map((entry) => (
                <li
                  key={entry.profileId}
                  className={cn(
                    "dda-leadership__row",
                    entry.rank <= 3 && "dda-leadership__row--podium",
                  )}
                >
                  <span
                    className={cn(
                      "dda-leadership__rank",
                      entry.rank === 1 && "dda-leadership__rank--gold",
                      entry.rank === 2 && "dda-leadership__rank--silver",
                      entry.rank === 3 && "dda-leadership__rank--bronze",
                    )}
                    aria-label={t("pages.community.leadershipRank", { rank: entry.rank })}
                  >
                    <span className="dda-leadership__rank-num">{entry.rank}</span>
                  </span>

                  <MemberAvatar initials={getMemberInitials(entry.name)} size="sm" />

                  <div className="dda-leadership__identity min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{entry.name}</span>
                      <Badge variant={statusBadgeVariant(entry.status)}>
                        {translateStatus(entry.status)}
                      </Badge>
                    </div>
                    {entry.handle ? (
                      <p className="truncate text-[11px] text-gray-500">{entry.handle}</p>
                    ) : null}
                  </div>

                  <div className="dda-leadership__metrics">
                    <div className="dda-leadership__metric">
                      <span className="dda-leadership__metric-label">
                        {t("pages.community.leadershipInvestments")}
                      </span>
                      <span className="dda-leadership__metric-value dda-leadership__metric-value--equity">
                        {formatPoolCurrency(entry.equity)}
                      </span>
                    </div>
                    <div className="dda-leadership__metric">
                      <span className="dda-leadership__metric-label">
                        {t("pages.community.leadershipTotalInvested")}
                      </span>
                      <span className="dda-leadership__metric-value">
                        {formatPoolCurrency(entry.contributed)}
                      </span>
                    </div>
                    <div className="dda-leadership__metric">
                      <span className="dda-leadership__metric-label">
                        {t("pages.community.leadershipRedemptions")}
                      </span>
                      <span className="dda-leadership__metric-value dda-leadership__metric-value--redeemed">
                        {formatPoolCurrency(entry.redeemed)}
                      </span>
                    </div>
                    <div className="dda-leadership__metric">
                      <span className="dda-leadership__metric-label">
                        {t("pages.community.leadershipScore")}
                      </span>
                      <span className="dda-leadership__metric-value">{entry.score}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {pageCount > 1 ? (
              <div className="dda-leadership__pager">
                <p className="dda-leadership__pager-meta">
                  {t("pages.community.leadershipPageRange", {
                    start: rangeStart,
                    end: rangeEnd,
                    total: leaders.length,
                  })}
                </p>
                <div className="dda-leadership__pager-controls">
                  <button
                    type="button"
                    className="dda-leadership__pager-btn"
                    disabled={page <= 0}
                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                    aria-label={t("pages.community.leadershipPrevPage")}
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                  </button>
                  <span className="dda-leadership__pager-page">
                    {t("pages.community.leadershipPageOf", {
                      page: page + 1,
                      pages: pageCount,
                    })}
                  </span>
                  <button
                    type="button"
                    className="dda-leadership__pager-btn"
                    disabled={page >= pageCount - 1}
                    onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                    aria-label={t("pages.community.leadershipNextPage")}
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="dda-leadership__empty">{t("pages.community.leadershipEmpty")}</p>
        )}
      </div>
    </section>
  );
}
