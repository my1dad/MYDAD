import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  FolderKanban,
  PauseCircle,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PORTFOLIO_VELOCITY,
  REPORT_PERIOD_FILTERS,
  STATUS_CHART_COLORS,
} from "../../data/reportsData";
import ElapsedTimeCalendar from "./ElapsedTimeCalendar";
import {
  calcProgress,
  countProjectTasks,
  filterActiveProjects,
  getOnHoldProjects,
  getProjectStageColor,
  isProjectOnHold,
} from "../../lib/projectUtils";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ReportStatCard({ icon: Icon, label, value, subtitle, accent }) {
  const accents = {
    slate: "bg-slate-500/10 text-slate-700 ring-slate-500/15",
    indigo: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/15",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15",
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/15",
  };

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div
        className={cn(
          "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1",
          accents[accent] ?? accents.slate
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className, bodyClassName }) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className={cn("min-h-0 flex-1 p-3 sm:p-4", bodyClassName)}>{children}</div>
    </div>
  );
}

function getProjectProgress(project) {
  return project.progress ?? calcProgress(project.phases) ?? 0;
}

function getProjectStatus(project) {
  if (isProjectOnHold(project)) {
    return { label: "On hold", className: "bg-red-50 text-red-700 ring-red-200" };
  }
  const progress = getProjectProgress(project);
  if (progress >= 40) {
    return { label: "On track", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
  }
  if (progress >= 20) {
    return { label: "At risk", className: "bg-amber-50 text-amber-700 ring-amber-200" };
  }
  return { label: "Getting started", className: "bg-slate-100 text-slate-600 ring-slate-200" };
}

function buildPortfolioSummary(projects) {
  const activeProjects = filterActiveProjects(projects);
  const total = activeProjects.length;
  const onTrack = activeProjects.filter((p) => getProjectProgress(p) >= 40 && !isProjectOnHold(p)).length;
  const atRisk = activeProjects.filter((p) => {
    const prog = getProjectProgress(p);
    return !isProjectOnHold(p) && prog >= 20 && prog < 40;
  }).length;
  const onHoldProjects = getOnHoldProjects(activeProjects);
  const onHold = onHoldProjects.length;
  const gettingStarted = activeProjects.filter((p) => {
    const prog = getProjectProgress(p);
    return !isProjectOnHold(p) && prog < 20;
  }).length;
  const overallProgress = total
    ? Math.round(activeProjects.reduce((sum, p) => sum + getProjectProgress(p), 0) / total)
    : 0;

  let tasksDone = 0;
  let tasksTotal = 0;
  for (const project of activeProjects) {
    const counts = countProjectTasks(project);
    tasksDone += counts.done;
    tasksTotal += counts.total;
  }

  const taskCompletionRate = tasksTotal
    ? Math.round((tasksDone / tasksTotal) * 100)
    : 0;

  return {
    activeProjects,
    total,
    onTrack,
    atRisk,
    onHold,
    gettingStarted,
    onHoldProjects,
    overallProgress,
    tasksDone,
    tasksTotal,
    taskCompletionRate,
  };
}

function PortfolioTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-md">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="mt-0.5 text-slate-600">{payload[0].value}% portfolio completion</p>
    </div>
  );
}

export default function ReportsPage({ projects = [] }) {
  const [period, setPeriod] = useState("30d");

  const summary = useMemo(() => buildPortfolioSummary(projects), [projects]);

  const statusChartData = useMemo(
    () =>
      [
        { name: "On track", value: summary.onTrack, color: STATUS_CHART_COLORS.onTrack },
        { name: "At risk", value: summary.atRisk, color: STATUS_CHART_COLORS.atRisk },
        { name: "On hold", value: summary.onHold, color: STATUS_CHART_COLORS.onHold },
        {
          name: "Getting started",
          value: summary.gettingStarted,
          color: STATUS_CHART_COLORS.gettingStarted,
        },
      ].filter((d) => d.value > 0),
    [summary]
  );

  const projectBars = useMemo(
    () =>
      [...summary.activeProjects]
        .sort((a, b) => getProjectProgress(b) - getProjectProgress(a))
        .map((project) => ({
          id: project.id,
          name:
            project.projectName.length > 14
              ? `${project.projectName.slice(0, 14)}…`
              : project.projectName,
          fullName: project.projectName,
          progress: getProjectProgress(project),
          fill: getProjectStageColor(project),
        })),
    [summary.activeProjects]
  );

  const periodLabel = REPORT_PERIOD_FILTERS.find((f) => f.id === period)?.label ?? "All time";

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2 text-base font-bold text-indigo-700 ring-1 ring-indigo-500/15">
              <BarChart3 className="h-5 w-5" />
              Reports
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Portfolio health, progress trends, and per-project breakdowns.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {REPORT_PERIOD_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStatCard
          icon={Target}
          label="Overall progress"
          value={`${summary.overallProgress}%`}
          subtitle={`Across ${summary.total} active project${summary.total === 1 ? "" : "s"}`}
          accent="indigo"
        />
        <ReportStatCard
          icon={FolderKanban}
          label="Active projects"
          value={summary.total}
          subtitle={`${summary.onTrack} on track · ${summary.atRisk} at risk`}
          accent="slate"
        />
        <ReportStatCard
          icon={CheckCircle2}
          label="Tasks completed"
          value={`${summary.taskCompletionRate}%`}
          subtitle={
            summary.tasksTotal > 0
              ? `${summary.tasksDone} of ${summary.tasksTotal} tasks done`
              : "No tasks tracked yet"
          }
          accent="emerald"
        />
        <ReportStatCard
          icon={PauseCircle}
          label="On hold"
          value={summary.onHold}
          subtitle={
            summary.onHold > 0 ? "Needs attention" : "All projects moving forward"
          }
          accent="amber"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,1.48fr)] lg:items-stretch">
        <ChartCard
          title="Project status"
          subtitle="Active portfolio mix"
          bodyClassName="p-2.5 sm:p-3"
        >
          {statusChartData.length === 0 ? (
            <div className="flex h-[220px] min-h-[200px] flex-col items-center justify-center text-center">
              <FolderKanban className="mb-2 h-6 w-6 text-slate-300" />
              <p className="text-xs font-medium text-slate-600">No active projects</p>
            </div>
          ) : (
            <div className="flex h-[220px] min-h-[200px] flex-col items-center justify-center gap-1">
              <div className="relative h-[168px] w-[168px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums leading-none text-slate-900">
                    {statusChartData.reduce((sum, item) => sum + item.value, 0)}
                  </span>
                  <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                    Active
                  </span>
                </div>
              </div>
              <ul className="flex w-full flex-wrap items-center justify-center gap-1">
                {statusChartData.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center gap-1 rounded-md border border-slate-100/80 bg-slate-50/70 px-1.5 py-0.5"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-[9px] font-medium leading-none text-slate-700">
                      {item.name}
                    </span>
                    <span
                      className="shrink-0 rounded px-1 py-px text-[9px] font-bold tabular-nums leading-none text-slate-900"
                      style={{ backgroundColor: `${item.color}22` }}
                    >
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Progress by project"
          subtitle="Completion % for each active project"
          bodyClassName="p-2.5 sm:p-3"
        >
          {projectBars.length === 0 ? (
            <p className="flex h-[220px] min-h-[200px] items-center justify-center text-sm text-slate-500">
              No active projects to chart.
            </p>
          ) : (
            <ul
              className="flex w-full flex-col gap-1"
              style={{ height: Math.max(220, projectBars.length * 34) }}
            >
              {projectBars.map((project) => (
                <li
                  key={project.id}
                  className="group grid h-[34px] grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] items-center gap-2.5 rounded-md px-1 transition-colors hover:bg-slate-50/80"
                  title={`${project.fullName} · ${project.progress}% complete`}
                >
                  <span
                    className="truncate text-[11px] font-semibold leading-none text-slate-800"
                  >
                    {project.fullName}
                  </span>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-100">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${project.progress}%`,
                          backgroundColor: project.fill,
                        }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums leading-none text-slate-600">
                      {project.progress}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <div className="mb-6">
        <ChartCard
          title="Portfolio velocity"
          subtitle={`Average completion · ${periodLabel}`}
        >
          <div className="h-[220px] w-full min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={PORTFOLIO_VELOCITY}
                margin={{ top: 12, right: 16, left: 8, bottom: 12 }}
              >
                <XAxis
                  dataKey="week"
                  height={48}
                  tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  dy={8}
                />
                <YAxis
                  domain={[0, 100]}
                  width={48}
                  tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<PortfolioTooltip />} />
                <Line
                  type="monotone"
                  dataKey="progress"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "#6366f1", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <ElapsedTimeCalendar
          projects={projects}
          compact
          className="h-full min-h-[320px]"
        />

        <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="shrink-0 border-b border-slate-100 px-4 py-3">
            <h3 className="text-xs font-semibold text-slate-900">Project breakdown</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Detailed view of progress and task completion
            </p>
          </div>

          {summary.activeProjects.length === 0 ? (
            <p className="flex flex-1 items-center justify-center px-4 text-sm text-slate-500">
              No active projects in the portfolio.
            </p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                  <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5">Project</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Progress</th>
                    <th className="px-3 py-2.5">Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...summary.activeProjects]
                    .sort((a, b) => getProjectProgress(b) - getProjectProgress(a))
                    .map((project) => {
                      const progress = getProjectProgress(project);
                      const { done, total } = countProjectTasks(project);
                      const status = getProjectStatus(project);
                      const color = getProjectStageColor(project);

                      return (
                        <tr key={project.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white"
                                style={{ backgroundColor: color }}
                              />
                              <span className="truncate font-medium text-slate-900">
                                {project.projectName}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "inline-flex whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                                status.className
                              )}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex min-w-[72px] items-center gap-1.5">
                              <div className="h-1.5 min-w-[2.5rem] flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${progress}%`, backgroundColor: color }}
                                />
                              </div>
                              <span className="w-7 shrink-0 text-[10px] font-semibold tabular-nums text-slate-700">
                                {progress}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-600">
                            {total > 0 ? (
                              <span>
                                {done}/{total}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {summary.onHoldProjects.length > 0 && (
            <div className="shrink-0 border-t border-red-100 bg-red-50/40 px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-red-600">
                <AlertTriangle className="h-3 w-3" />
                Projects on hold
              </div>
              <ul className="space-y-1 text-xs text-slate-700">
                {summary.onHoldProjects.map((project) => (
                  <li key={project.id} className="flex items-center gap-1.5 truncate">
                    <PauseCircle className="h-3 w-3 shrink-0 text-red-500" />
                    {project.projectName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-500">
        <TrendingUp className="h-4 w-4 shrink-0 text-indigo-500" />
        Velocity chart uses sample trend data; project metrics reflect your live portfolio.
      </div>
    </div>
  );
}
