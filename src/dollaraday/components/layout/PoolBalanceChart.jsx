import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";
import {
  buildPoolBalanceChartSeries,
  getPoolBalanceHistoryRevision,
  subscribePoolBalanceHistory,
} from "../../lib/poolBalanceHistory";
import { usePoolState } from "../../lib/poolState";

function formatAxisValue(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

const EVENT_MARKER_COLORS = {
  escrow_in: "#38bdf8",
  escrow_out: "#f87171",
  allocation: "#eab308",
  contribution: "#34d399",
  yield: "#a78bfa",
};

function eventMarkerColor(events) {
  if (!events?.length) return null;
  const priority = ["escrow_in", "allocation", "escrow_out", "yield"];
  for (const kind of priority) {
    if (events.some((event) => event.kind === kind)) {
      return EVENT_MARKER_COLORS[kind];
    }
  }
  return EVENT_MARKER_COLORS.escrow_in;
}

const EVENT_KIND_LABEL_KEYS = {
  escrow_in: "pool.eventLegendEscrowIn",
  escrow_out: "pool.eventLegendEscrowOut",
  allocation: "pool.eventLegendAllocation",
  contribution: "pool.eventLegendContribution",
  yield: "pool.eventLegendYield",
};

function formatEventAmount(event, t) {
  if (event.kind === "allocation") {
    return t("pool.eventAllocated", { amount: formatPoolCurrency(event.amount) });
  }
  if (event.kind === "escrow_out") {
    return `−${formatPoolCurrency(event.amount)}`;
  }
  return `+${formatPoolCurrency(event.amount)}`;
}

function BalanceTooltip({ active, payload, label, coordinate, plotRef, t }) {
  if (!active || !payload?.length || !coordinate || !plotRef?.current) return null;

  const point = payload[0].payload;
  const value = point.balance;
  const prev = point.prevBalance;
  const delta = prev != null ? value - prev : null;

  const plotRect = plotRef.current.getBoundingClientRect();
  const anchorX = plotRect.left + coordinate.x;
  const anchorY = plotRect.top + coordinate.y;
  const showBelow = anchorY < 140;
  const clampedX = Math.min(Math.max(anchorX, 140), window.innerWidth - 140);

  return createPortal(
    <div
      className="dda-chart-tooltip dda-pool-balance-tooltip"
      style={{
        position: "fixed",
        left: clampedX,
        top: anchorY,
        transform: showBelow
          ? "translate(-50%, 14px)"
          : "translate(-50%, calc(-100% - 14px))",
        zIndex: 200,
        pointerEvents: "none",
      }}
    >
      <div className="dda-pool-balance-tooltip__head">
        <p className="dda-pool-balance-tooltip__date">{label}</p>
        <p className="dda-pool-balance-tooltip__balance">{formatPoolCurrency(value)}</p>
        {delta != null ? (
          <p
            className={cn(
              "dda-pool-balance-tooltip__delta",
              delta >= 0 ? "dda-pool-balance-tooltip__delta--up" : "dda-pool-balance-tooltip__delta--down",
            )}
          >
            {t("pool.vsPriorDelta", {
              delta: `${delta >= 0 ? "+" : ""}${formatPoolCurrency(delta)}`,
            })}
          </p>
        ) : null}
      </div>

      {point.events?.length ? (
        <div className="dda-pool-balance-tooltip__events">
          <p className="dda-pool-balance-tooltip__events-title">{t("pool.eventActivityTitle")}</p>
          <ul className="dda-pool-balance-tooltip__event-list">
            {point.events.map((event, index) => {
              const typeLabel = t(EVENT_KIND_LABEL_KEYS[event.kind] ?? "pool.eventLegendAllocation");
              const showDetail = event.label && event.label !== typeLabel;

              return (
                <li
                  key={event.id}
                  className={cn(
                    "dda-pool-balance-tooltip__event",
                    index % 2 === 0
                      ? "dda-pool-balance-tooltip__event--even"
                      : "dda-pool-balance-tooltip__event--odd",
                  )}
                >
                  <div className="dda-pool-balance-tooltip__event-top">
                    <span
                      className="dda-pool-balance-tooltip__event-type"
                      style={{ color: EVENT_MARKER_COLORS[event.kind] }}
                    >
                      <span
                        className="dda-pool-balance-tooltip__event-dot"
                        style={{ backgroundColor: EVENT_MARKER_COLORS[event.kind] }}
                      />
                      {typeLabel}
                    </span>
                    <span
                      className={cn(
                        "dda-pool-balance-tooltip__event-amount",
                        event.kind === "escrow_out" && "dda-pool-balance-tooltip__event-amount--out",
                        event.kind === "allocation" && "dda-pool-balance-tooltip__event-amount--alloc",
                      )}
                    >
                      {formatEventAmount(event, t)}
                    </span>
                  </div>
                  {showDetail ? (
                    <p className="dda-pool-balance-tooltip__event-detail">{event.label}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function EventDot(props) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;

  const color = eventMarkerColor(payload?.events);
  if (!color) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={3}
        fill="#071013"
        stroke="var(--color-dda-green-light)"
        strokeWidth={2}
      />
    );
  }

  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.18} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="#071013" strokeWidth={2} />
    </g>
  );
}

function usePoolBalanceRevision() {
  return useSyncExternalStore(
    subscribePoolBalanceHistory,
    getPoolBalanceHistoryRevision,
    () => "",
  );
}

export default function PoolBalanceChart() {
  const { t, locale } = useLocale();
  const { poolBalanceIntervals } = useLocalizedData();
  const [interval, setInterval] = useState("1m");
  const { poolSummary } = usePoolState();
  const plotRef = useRef(null);
  usePoolBalanceRevision();

  const chartData = useMemo(() => {
    const points = buildPoolBalanceChartSeries(interval, locale, poolSummary.totalBalance);
    return points.map((point, index) => ({
      ...point,
      prevBalance: index > 0 ? points[index - 1].balance : null,
    }));
  }, [interval, locale, poolSummary.totalBalance]);

  const eventCount = useMemo(
    () => chartData.reduce((sum, point) => sum + (point.events?.length ?? 0), 0),
    [chartData],
  );

  const periodDelta = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].balance;
    const last = chartData[chartData.length - 1].balance;
    const change = last - first;
    const pct = first ? (change / first) * 100 : 0;
    return { change, pct };
  }, [chartData]);

  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 1];
    const values = chartData.map((point) => point.balance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.12 || max * 0.02 || 1;
    return [Math.floor(Math.max(0, min - padding)), Math.ceil(max + padding)];
  }, [chartData]);

  const legendItems = [
    { kind: "escrow_in", labelKey: "pool.eventLegendEscrowIn" },
    { kind: "allocation", labelKey: "pool.eventLegendAllocation" },
    { kind: "escrow_out", labelKey: "pool.eventLegendEscrowOut" },
  ];

  return (
    <div className="dda-panel rounded-xl p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{t("pool.balanceTrend")}</p>
          {periodDelta ? (
            <p className="mt-0.5 text-xs text-gray-500">
              <span className={periodDelta.change >= 0 ? "text-dda-green-light" : "text-red-400"}>
                {periodDelta.change >= 0 ? "+" : ""}
                {formatPoolCurrency(periodDelta.change)}
              </span>{" "}
              ({periodDelta.pct >= 0 ? "+" : ""}
              {periodDelta.pct.toFixed(2)}%) {t("pool.inRange")}
            </p>
          ) : null}
          {eventCount > 0 ? (
            <p className="mt-1 text-[11px] text-gray-500">{t("pool.eventMarkersHint")}</p>
          ) : null}
        </div>

        <div className="flex gap-1 rounded-lg bg-black/30 p-1">
          {poolBalanceIntervals.map((item) => {
            const active = interval === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setInterval(item.id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition sm:px-3 sm:text-xs",
                  active
                    ? "bg-dda-green-light/15 text-dda-green-light shadow-sm"
                    : "text-gray-400 hover:text-white",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={plotRef} className="dda-pool-balance-chart__plot h-48 w-full sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="poolLineGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-dda-green-light)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-dda-green-light)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 4"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={6}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              domain={yDomain}
              width={52}
              tick={{ fontSize: 10, fill: "#6b7280", fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatAxisValue}
            />
            <Tooltip
              content={<BalanceTooltip t={t} plotRef={plotRef} />}
              cursor={{ stroke: "rgba(52, 211, 153, 0.35)", strokeWidth: 1 }}
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ visibility: "hidden", pointerEvents: "none" }}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke="var(--color-dda-green-light)"
              strokeWidth={2.5}
              dot={<EventDot />}
              activeDot={{ r: 6, fill: "var(--color-dda-green-light)", stroke: "#071013", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {eventCount > 0 ? (
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3 text-[11px] text-gray-500">
          {legendItems.map((item) => (
            <li key={item.kind} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: EVENT_MARKER_COLORS[item.kind] }}
              />
              {t(item.labelKey)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] text-gray-500">
        <span>{t("pool.currentBalance", { amount: formatPoolCurrency(poolSummary.totalBalance) })}</span>
        <span className="text-gray-600">{t("pool.hoverHint")}</span>
      </div>
    </div>
  );
}
