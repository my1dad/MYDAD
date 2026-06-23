import { ChevronDown, CircleDollarSign, Lock, Percent } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";
import { DDA_THEME } from "../../lib/theme";

const secondaryStatConfig = {
  escrow: {
    icon: Lock,
    accent: DDA_THEME.greenLight,
    hintKey: "stats.segregatedReserve",
  },
  daily: {
    icon: CircleDollarSign,
    accent: DDA_THEME.green,
    hintKey: "stats.memberInflowToday",
  },
  apy: {
    icon: Percent,
    accent: DDA_THEME.goldLight,
    hintKey: "stats.annualPoolYield",
  },
};

function SecondaryStatCard({ statKey, label, value, hint }) {
  const config = secondaryStatConfig[statKey];
  const Icon = config?.icon ?? CircleDollarSign;
  const accent = config?.accent ?? DDA_THEME.greenLight;

  return (
    <div className="dda-glass-btn group relative flex min-w-0 flex-1 flex-col p-3 sm:p-5">
      <div className="relative flex items-start justify-between gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition group-hover:scale-105 sm:h-10 sm:w-10"
          style={{
            backgroundColor: `${accent}18`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}33`,
          }}
        >
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={2.25} />
        </span>
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full opacity-90"
          style={{ backgroundColor: accent }}
          aria-hidden="true"
        />
      </div>

      <p className="relative mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:text-[11px]">
        {label}
      </p>
      <p className="relative mt-1 truncate text-lg font-bold tabular-nums leading-none text-white sm:mt-1.5 sm:text-2xl">
        {value}
      </p>
      {hint ? (
        <p className="relative mt-2 hidden text-[11px] text-gray-500 sm:block">{hint}</p>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export default function DashboardCard({
  children,
  className,
  title,
  subtitle,
  action,
  compact = false,
  noPadding = false,
  collapsible = false,
  defaultCollapsed = false,
  collapseAriaLabel,
  expandAriaLabel,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const headerContent = (
    <div className="min-w-0 flex-1 text-left">
      {title && <h3 className="truncate text-lg font-semibold text-white">{title}</h3>}
      {subtitle && !collapsed ? (
        <p className="mt-0.5 truncate text-sm text-gray-400">{subtitle}</p>
      ) : null}
    </div>
  );

  return (
    <section className={cn("dda-glass overflow-hidden", className)}>
      {(title || action || collapsible) && (
        <div
          className={cn(
            "flex items-start justify-between gap-2 border-b border-white/10",
            compact ? "px-4 py-3" : "px-5 py-4",
            collapsed && "border-b-0",
          )}
        >
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((open) => !open)}
              className="dda-card-collapse-trigger flex min-w-0 flex-1 items-start gap-2 text-left"
              aria-expanded={!collapsed}
              aria-label={collapsed ? expandAriaLabel : collapseAriaLabel}
            >
              {headerContent}
              <ChevronDown
                className={cn(
                  "dda-card-collapse-trigger__chevron mt-1 h-5 w-5 shrink-0 text-gray-500",
                  !collapsed && "dda-card-collapse-trigger__chevron--open",
                )}
                aria-hidden="true"
              />
            </button>
          ) : (
            headerContent
          )}
          {action}
        </div>
      )}
      {!collapsed ? (
        <div className={noPadding ? undefined : compact ? "p-4" : "p-5"}>{children}</div>
      ) : null}
    </section>
  );
}

export function StatCard({ title, value, className }) {
  return (
    <div className={cn("dda-glass min-w-0 flex-1 rounded-2xl p-3 sm:p-5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:text-xs sm:normal-case sm:tracking-normal sm:text-gray-400 md:text-sm">
        {title}
      </p>
      <h2 className="mt-1.5 text-base font-bold tabular-nums leading-tight text-white sm:mt-2 sm:text-2xl">
        {value}
      </h2>
    </div>
  );
}

/** Escrow, daily contributions, and pool APY in a horizontal row. */
export function PoolSecondaryStats({ stats, hints }) {
  const { t } = useLocale();
  const items = [
    { key: "escrow", ...stats.escrow },
    { key: "daily", ...stats.daily },
    { key: "apy", ...stats.apy },
  ];

  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-4">
      {items.map((stat) => (
        <SecondaryStatCard
          key={stat.key}
          statKey={stat.key}
          label={stat.label}
          value={stat.value}
          hint={hints?.[stat.key] ?? t(secondaryStatConfig[stat.key]?.hintKey)}
        />
      ))}
    </section>
  );
}

/** @deprecated Use PoolSecondaryStats with { escrow, daily, apy } shape. */
export function PoolStatsGrid({ stats }) {
  return <PoolSecondaryStats stats={stats} />;
}

export function FeatureCard({ title, desc, onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "dda-glass rounded-2xl p-5 text-left transition hover:border-dda-gold-light/20 hover:bg-white/[0.07]",
        className
      )}
    >
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-400">{desc}</p>
    </button>
  );
}

export function MemberAvatar({ initials, size = "md" }) {
  const sizes = {
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  return (
    <div
      className={cn(
        "dda-avatar",
        sizes[size]
      )}
    >
      {initials}
    </div>
  );
}

export function ProgressBar({ value, className }) {
  return (
    <div className={cn("dda-progress-track", className)}>
      <div
        className="dda-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Badge({ children, variant = "default" }) {
  const variants = {
    default: "bg-white/10 text-gray-300 ring-white/10",
    success: "bg-dda-green/15 text-dda-green-light ring-dda-green/25",
    warning: "bg-dda-gold/15 text-dda-gold-light ring-dda-gold/25",
    danger: "bg-red-500/15 text-red-400 ring-red-500/25",
    info: "bg-sky-500/15 text-sky-400 ring-sky-500/25",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
        variants[variant] ?? variants.default
      )}
    >
      {children}
    </span>
  );
}
