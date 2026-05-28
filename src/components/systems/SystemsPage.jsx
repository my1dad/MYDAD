import { useMemo, useState } from "react";
import {
  Activity,
  Cpu,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Server,
  Zap,
} from "lucide-react";
import {
  CONNECTED_SYSTEMS,
  SYSTEM_ACTIVITY,
  SYSTEM_CATEGORY_FILTERS,
  SYSTEM_STATUS_FILTERS,
  SYSTEM_STATUS_STYLES,
} from "../../data/systemsData";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function SystemStatCard({ icon: Icon, label, value, subtitle, accent }) {
  const accents = {
    sky: "bg-sky-500/10 text-sky-700 ring-sky-500/15",
    emerald: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/15",
    violet: "bg-violet-500/10 text-violet-700 ring-violet-500/15",
    slate: "bg-slate-500/10 text-slate-700 ring-slate-500/15",
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

const CATEGORY_ICONS = {
  integration: Link2,
  infrastructure: Server,
  automation: Zap,
};

const ACTIVITY_LEVEL_STYLES = {
  info: "border-slate-200 bg-slate-50",
  warn: "border-amber-200 bg-amber-50/60",
  error: "border-red-200 bg-red-50/60",
};

export default function SystemsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const stats = useMemo(() => {
    const operational = CONNECTED_SYSTEMS.filter((s) => s.status === "operational").length;
    const integrations = CONNECTED_SYSTEMS.filter((s) => s.category === "integration").length;
    const automations = CONNECTED_SYSTEMS.filter((s) => s.category === "automation").length;

    return {
      total: CONNECTED_SYSTEMS.length,
      operational,
      integrations,
      automations,
    };
  }, []);

  const filteredSystems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return CONNECTED_SYSTEMS.filter((system) => {
      if (statusFilter !== "all" && system.status !== statusFilter) return false;
      if (categoryFilter !== "all" && system.category !== categoryFilter) return false;

      if (!query) return true;
      const haystack = `${system.name} ${system.description} ${system.project ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [search, statusFilter, categoryFilter]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-sky-50/50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-sky-500/10 px-4 py-2 text-base font-bold text-sky-700 ring-1 ring-sky-500/15">
              <Cpu className="h-5 w-5" />
              Systems
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Connected integrations, infrastructure, and automations powering Over Drive OS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Sync all
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              Connect system
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SystemStatCard
          icon={Cpu}
          label="Connected systems"
          value={stats.total}
          subtitle="Across your stack"
          accent="sky"
        />
        <SystemStatCard
          icon={Activity}
          label="Operational"
          value={stats.operational}
          subtitle="Healthy and syncing"
          accent="emerald"
        />
        <SystemStatCard
          icon={Link2}
          label="Integrations"
          value={stats.integrations}
          subtitle="External services"
          accent="violet"
        />
        <SystemStatCard
          icon={Zap}
          label="Automations"
          value={stats.automations}
          subtitle="Workflows & jobs"
          accent="slate"
        />
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search systems…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-1">
            {SYSTEM_STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                  statusFilter === f.id
                    ? "bg-sky-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            {SYSTEM_CATEGORY_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredSystems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Cpu className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No systems match</p>
          <p className="mt-1 text-xs text-slate-500">Try a different filter or search term.</p>
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSystems.map((system) => {
            const status = SYSTEM_STATUS_STYLES[system.status];
            const CategoryIcon = CATEGORY_ICONS[system.category] ?? Server;

            return (
              <article
                key={system.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:shadow-md"
              >
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                        <CategoryIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">
                          {system.name}
                        </h3>
                        <p className="mt-0.5 text-[11px] font-medium capitalize text-slate-500">
                          {system.category}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                        status.badge
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">{system.description}</p>
                </div>

                <div className="mt-auto space-y-3 p-5 pt-4">
                  {system.project && (
                    <span
                      className="inline-block truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${system.projectColor}15`,
                        color: system.projectColor,
                      }}
                    >
                      {system.project}
                    </span>
                  )}

                  <dl className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-100">
                      <dt className="font-semibold uppercase tracking-wide text-slate-400">Uptime</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums text-slate-800">
                        {system.uptime}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-100">
                      <dt className="font-semibold uppercase tracking-wide text-slate-400">Version</dt>
                      <dd className="mt-0.5 font-semibold text-slate-800">{system.version}</dd>
                    </div>
                  </dl>

                  <p className="text-[11px] text-slate-500">
                    Last sync: <span className="font-medium text-slate-700">{system.lastSync}</span>
                  </p>

                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800"
                  >
                    Manage connection
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
          <p className="mt-0.5 text-xs text-slate-500">Latest events across connected systems</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {SYSTEM_ACTIVITY.map((event) => (
            <li
              key={event.id}
              className={cn(
                "flex flex-col gap-1 border-l-4 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                event.level === "warn"
                  ? "border-l-amber-400"
                  : event.level === "error"
                    ? "border-l-red-400"
                    : "border-l-sky-400",
                ACTIVITY_LEVEL_STYLES[event.level]
              )}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{event.system}</p>
                <p className="mt-0.5 text-sm text-slate-600">{event.message}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">{event.time}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
