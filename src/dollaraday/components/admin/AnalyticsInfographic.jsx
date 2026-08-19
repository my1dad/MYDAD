import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Eye,
  Globe,
  MousePointerClick,
  Users,
} from "lucide-react";
import { DDA_THEME_VARS } from "../../lib/theme";
import { useLocale } from "../../i18n/LocaleContext";

const SLICE_COLORS = [
  "var(--color-dda-green-light)",
  "var(--color-dda-gold-light)",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#fb923c",
];

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatTick(timestamp, range) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  if (range === "24h") return date.toLocaleTimeString(undefined, { hour: "numeric" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function countryLabel(code) {
  if (!code || code === "Direct") return code || "—";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function withColors(rows, formatLabel) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.reduce((sum, row) => sum + (Number(row.pageviews) || Number(row.visitors) || 0), 0);
  return list.map((row, index) => {
    const value = Number(row.pageviews) || Number(row.visitors) || 0;
    return {
      ...row,
      name: formatLabel ? formatLabel(row.label) : row.label,
      value,
      color: SLICE_COLORS[index % SLICE_COLORS.length],
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
    };
  });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dda-chart-tooltip">
      {label ? <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.dataKey || entry.name} className="mt-0.5 tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {formatCount(entry.value)}
        </p>
      ))}
    </div>
  );
}

function SliceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="dda-chart-tooltip">
      <p className="font-semibold text-white">{item.name}</p>
      <p className="mt-0.5 tabular-nums" style={{ color: item.color }}>
        {formatCount(item.value)} · {item.pct}%
      </p>
    </div>
  );
}

function GaugeRing({ percent, value, label }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, Number(percent) || 0));
  return (
    <div className="dda-analytics__gauge" aria-label={`${label}: ${value}`}>
      <svg viewBox="0 0 120 120" className="dda-analytics__gauge-svg">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-dda-green-light)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="dda-analytics__gauge-center">
        <span className="dda-analytics__gauge-value">{value}</span>
        <span className="dda-analytics__gauge-label">{label}</span>
      </div>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, accent }) {
  return (
    <div className="dda-pool-metric-btn dda-glass-btn" style={{ "--pool-metric-accent": accent }}>
      <span
        className="dda-pool-metric-btn__icon"
        style={{
          backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 28%, transparent)`,
        }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="dda-pool-metric-btn__copy">
        <span className="dda-pool-metric-btn__label">{label}</span>
        <span className="dda-pool-metric-btn__value">{value}</span>
      </span>
    </div>
  );
}

function DonutBlock({ title, slices, empty, centerValue, centerLabel }) {
  const plot = slices.length ? slices : [{ name: empty, value: 1, color: "rgba(255,255,255,0.08)", pct: 0 }];
  return (
    <div className="dda-panel flex flex-col rounded-xl p-4">
      <p className="mb-2 text-sm font-medium text-white">{title}</p>
      <div className="dda-donut-chart relative mx-auto h-44 w-full max-w-[16rem]">
        <ResponsiveContainer width="100%" height="100%" className="dda-donut-chart__plot">
          <PieChart>
            <Pie
              data={plot}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="#071013"
              strokeWidth={2}
            >
              {plot.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            {slices.length ? <Tooltip content={<SliceTooltip />} wrapperStyle={{ zIndex: 50, outline: "none" }} /> : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="dda-donut-chart__center pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular-nums text-white">{centerValue}</span>
          <span className="text-[10px] text-gray-500">{centerLabel}</span>
        </div>
      </div>
      {slices.length ? (
        <ul className="mt-3 space-y-2">
          {slices.map((slice) => (
            <li key={slice.name} className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex min-w-0 items-center gap-2 text-gray-300">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="truncate">{slice.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-white">
                {formatCount(slice.value)} · {slice.pct}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-center text-xs text-gray-500">{empty}</p>
      )}
    </div>
  );
}

function RankFunnel({ title, rows, empty, formatLabel }) {
  const slices = withColors(rows, formatLabel);
  const max = Math.max(1, ...slices.map((row) => row.value));
  return (
    <div className="dda-panel flex flex-col rounded-xl p-4">
      <p className="mb-3 text-sm font-medium text-white">{title}</p>
      {slices.length ? (
        <>
          <div className="dda-analytics__funnel mb-4">
            {slices.map((row) => (
              <span
                key={row.name}
                title={`${row.name} ${row.pct}%`}
                style={{
                  width: `${Math.max(8, row.pct)}%`,
                  backgroundColor: row.color,
                }}
              />
            ))}
          </div>
          <ul className="space-y-2.5">
            {slices.map((row) => (
              <li key={row.name}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-gray-200">{row.name}</span>
                  <span className="shrink-0 tabular-nums text-white">
                    {formatCount(row.value)} · {row.pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, Math.round((row.value / max) * 100))}%`,
                      backgroundColor: row.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="dda-analytics__funnel dda-analytics__funnel--empty mb-4" />
          <p className="text-center text-sm text-gray-500">{empty}</p>
        </>
      )}
    </div>
  );
}

export default function AnalyticsInfographic({ data, range, loading }) {
  const { t } = useLocale();
  const visitors = Number(data?.totals?.visitors) || 0;
  const pageviews = Number(data?.totals?.pageviews) || 0;
  const perVisitor = visitors > 0 ? (pageviews / visitors).toFixed(1) : "0";
  const countries = Array.isArray(data?.countries) ? data.countries : [];
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const devices = withColors(data?.devices);
  const browsers = withColors(data?.browsers);
  const countrySlices = withColors(countries, countryLabel);

  const chartRows = useMemo(
    () =>
      (Array.isArray(data?.timeseries) ? data.timeseries : []).map((row) => ({
        ...row,
        label: formatTick(row.timestamp, range),
      })),
    [data, range],
  );

  const peakViews = chartRows.reduce((max, row) => Math.max(max, row.pageviews || 0), 0);
  const gaugePct = pageviews > 0 ? Math.min(1, visitors / pageviews) : 0;
  const empty = t("pages.analytics.empty");

  return (
    <div className="dda-analytics space-y-4 sm:space-y-5">
      <section className="dda-glass overflow-hidden rounded-2xl">
        <div className="dda-accent-bar" />
        <div className="dda-analytics__hero">
          <GaugeRing
            percent={gaugePct || 0.08}
            value={loading ? "—" : formatCount(visitors)}
            label={t("pages.analytics.visitors")}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dda-green-light">
              {t("pages.analytics.livePulse")}
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white sm:text-4xl">
              {loading ? "—" : formatCount(pageviews)}
            </p>
            <p className="mt-1 text-sm text-gray-400">{t("pages.analytics.heroHint")}</p>
            <div className="mt-4 h-20 w-full">
              {chartRows.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRows} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ddaAnalyticsSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={DDA_THEME_VARS.greenLight} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={DDA_THEME_VARS.greenLight} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="pageviews"
                      stroke={DDA_THEME_VARS.greenLight}
                      fill="url(#ddaAnalyticsSpark)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-end gap-1 px-1">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span
                      key={i}
                      className="dda-analytics__eq-bar"
                      style={{ height: `${18 + ((i * 17) % 40)}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="dda-pool-metrics border-t border-white/10 px-3 py-3 sm:px-4">
          <MetricTile
            icon={Users}
            label={t("pages.analytics.visitors")}
            value={loading ? "—" : formatCount(visitors)}
            accent={DDA_THEME_VARS.greenLight}
          />
          <MetricTile
            icon={Eye}
            label={t("pages.analytics.pageviews")}
            value={loading ? "—" : formatCount(pageviews)}
            accent={DDA_THEME_VARS.goldLight}
          />
          <MetricTile
            icon={MousePointerClick}
            label={t("pages.analytics.perVisitor")}
            value={loading ? "—" : perVisitor}
            accent="#38bdf8"
          />
          <MetricTile
            icon={Globe}
            label={t("pages.analytics.regions")}
            value={loading ? "—" : formatCount(countries.length)}
            accent="#a78bfa"
          />
        </div>
      </section>

      <section className="dda-glass rounded-2xl p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white">{t("pages.analytics.traffic")}</p>
            <p className="text-xs text-gray-500">{t("pages.analytics.trafficHint")}</p>
          </div>
          {peakViews > 0 ? (
            <p className="text-xs text-gray-500">
              {t("pages.analytics.peak")}: <span className="tabular-nums text-white">{formatCount(peakViews)}</span>
            </p>
          ) : null}
        </div>
        <div className="h-64 w-full">
          {loading ? (
            <div className="h-full animate-pulse rounded-xl bg-white/5" />
          ) : chartRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddaAnalyticsViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DDA_THEME_VARS.greenLight} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={DDA_THEME_VARS.greenLight} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="pageviews"
                  name={t("pages.analytics.pageviews")}
                  stroke={DDA_THEME_VARS.greenLight}
                  fill="url(#ddaAnalyticsViews)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name={t("pages.analytics.visitors")}
                  stroke={DDA_THEME_VARS.goldLight}
                  fill="none"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <div className="dda-analytics__wave" aria-hidden="true" />
              {empty}
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankFunnel
          title={t("pages.analytics.pages")}
          rows={pages}
          empty={empty}
        />
        <RankFunnel
          title={t("pages.analytics.referrers")}
          rows={Array.isArray(data?.referrers) ? data.referrers : []}
          empty={empty}
        />
        <DonutBlock
          title={t("pages.analytics.countries")}
          slices={countrySlices}
          empty={empty}
          centerValue={formatCount(countries.length)}
          centerLabel={t("pages.analytics.regions")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DonutBlock
            title={t("pages.analytics.deviceType")}
            slices={devices}
            empty={empty}
            centerValue={devices[0]?.pct ? `${devices[0].pct}%` : "0%"}
            centerLabel={devices[0]?.name || t("pages.analytics.devices")}
          />
          <DonutBlock
            title={t("pages.analytics.browsers")}
            slices={browsers}
            empty={empty}
            centerValue={formatCount(browsers.length)}
            centerLabel={t("pages.analytics.browsers")}
          />
        </div>
      </div>
    </div>
  );
}
