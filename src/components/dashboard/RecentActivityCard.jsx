import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  History,
  Link2,
  Paperclip,
  RotateCcw,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  ACTIVITY_FILTERS,
  buildDashboardRecentActivity,
  countDashboardActivity,
  filterDashboardActivity,
} from "../../lib/dashboardRecentActivity";
import { ACTIVITY_UPDATED_EVENT } from "../../lib/workspaceActivityLog";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const ACTIVITY_GRID =
  "grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,1.15fr)_minmax(0,0.8fr)]";

const TONE_STYLES = {
  indigo: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/15",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15",
  violet: "bg-violet-500/10 text-violet-600 ring-violet-500/15",
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/15",
  rose: "bg-rose-500/10 text-rose-600 ring-rose-500/15",
  sky: "bg-sky-500/10 text-sky-600 ring-sky-500/15",
  slate: "bg-slate-500/10 text-slate-600 ring-slate-500/15",
  cyan: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/15",
};

function activityIcon(entry) {
  const category = entry.category;
  const title = entry.title ?? "";

  if (title.includes("deleted")) return Trash2;
  if (title.includes("restored")) return RotateCcw;
  if (title.includes("completed")) return CheckCircle2;
  if (title.includes("connected")) return Link2;
  if (category === "projects") return FolderKanban;
  if (category === "files") return Paperclip;
  if (category === "tasks") return Clock3;
  if (category === "events") return CalendarDays;
  if (category === "profile") {
    if (title.includes("Team") || title.includes("Workspace") || title.includes("Time zone")) {
      return Settings2;
    }
    return UserRound;
  }
  if (category === "team") return Users;
  return History;
}

export default function RecentActivityCard({
  className,
  subtitle = "Projects, files, tasks, events, profile, and team changes",
  maxListHeight = "max-h-[220px]",
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setRefreshKey((value) => value + 1);
    window.addEventListener(ACTIVITY_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(ACTIVITY_UPDATED_EVENT, handleUpdate);
  }, []);

  const activity = useMemo(
    () => buildDashboardRecentActivity(),
    [refreshKey]
  );

  const filterCounts = useMemo(() => countDashboardActivity(activity), [activity]);

  const [filter, setFilter] = useState("all");

  const filteredActivity = useMemo(
    () => filterDashboardActivity(activity, filter),
    [activity, filter]
  );

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className
      )}
    >
      <div className="h-1 w-full bg-gradient-to-r from-slate-500 to-slate-700" />
      <div className="flex flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-500/10 text-slate-700 ring-1 ring-inset ring-slate-500/15">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              Recent Activity
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="mb-2 flex shrink-0 flex-wrap gap-x-0.5 gap-y-0 border-b border-slate-100">
          {ACTIVITY_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "inline-flex items-center gap-1 border-b-2 px-1.5 py-1.5 text-[10px] font-medium transition sm:px-2",
                filter === item.id
                  ? "border-slate-700 text-slate-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              <span>{item.label}</span>
              <span
                className={cn(
                  "min-w-[1rem] rounded-full px-1 py-px text-[9px] font-semibold tabular-nums leading-none",
                  filter === item.id
                    ? "bg-slate-200 text-slate-700"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {filterCounts[item.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div
          className={cn(
            "mb-1 grid shrink-0 items-center gap-2 px-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400",
            ACTIVITY_GRID
          )}
        >
          <span className="min-w-0 truncate">Type</span>
          <span className="min-w-0 truncate">Activity</span>
          <span className="min-w-0 truncate">Details</span>
          <span className="min-w-0 truncate text-right">When</span>
        </div>

        {activity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
            <History className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No recent activity yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Create a project, upload a file, or update your profile to see updates here.
            </p>
          </div>
        ) : filteredActivity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
            <History className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No activity in this filter</p>
            <p className="mt-1 text-xs text-slate-500">Try another category tab above.</p>
          </div>
        ) : (
          <ul className={cn("dashboard-widget-scroll space-y-0.5 overflow-y-auto", maxListHeight)}>
            {filteredActivity.map((item, index) => {
              const Icon = activityIcon(item);
              const tone = TONE_STYLES[item.tone] ?? TONE_STYLES.indigo;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "grid items-center gap-2 rounded-lg px-2 py-2",
                    ACTIVITY_GRID,
                    index % 2 === 0 ? "bg-white" : "bg-slate-50/90"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                        tone
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="min-w-0 truncate text-[10px] font-semibold text-slate-600">
                      {ACTIVITY_FILTERS.find((entry) => entry.id === item.category)?.label ??
                        "Activity"}
                    </span>
                  </div>

                  <p
                    className="min-w-0 truncate text-[11px] font-semibold text-slate-800"
                    title={item.title}
                  >
                    {item.title}
                  </p>

                  <p
                    className="min-w-0 truncate text-[11px] text-slate-600"
                    title={item.meta ? `${item.message} · ${item.meta}` : item.message}
                  >
                    <span className="font-medium text-slate-700">{item.message}</span>
                    {item.meta ? (
                      <span className="text-slate-400"> · {item.meta}</span>
                    ) : null}
                  </p>

                  <span className="min-w-0 truncate text-right text-[10px] font-medium text-slate-400">
                    {item.timeLabel}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
