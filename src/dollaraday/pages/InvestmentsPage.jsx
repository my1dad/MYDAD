import { useMemo, useState } from "react";
import { Layers, Percent, PiggyBank, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "../components/layout/PageHeader";
import InvestmentHighlights from "../components/investments/InvestmentHighlights";
import InvestmentInfographic from "../components/investments/InvestmentInfographic";
import InvestmentYieldChart from "../components/investments/InvestmentYieldChart";
import { formatPoolCurrency } from "../data/mockData";
import { useLocale } from "../i18n/LocaleContext";
import { useLocalizedData } from "../i18n/localizedData";
import { usePoolState } from "../lib/poolState";

function HeroStatCard({ title, value, icon: Icon, accent }) {
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
        {title}
      </p>
      <p className="relative mt-1 truncate text-lg font-bold tabular-nums leading-none text-white sm:mt-1.5 sm:text-2xl">
        {value}
      </p>
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

export default function InvestmentsPage() {
  const { t } = useLocale();
  const { investments, investmentHighlights } = useLocalizedData();
  const [selectedId, setSelectedId] = useState(investments[0]?.id);
  const { poolSummary } = usePoolState();

  const totalAllocated = useMemo(
    () => investments.reduce((sum, item) => sum + item.allocated, 0),
    [investments]
  );

  const selectedInvestment = useMemo(
    () => investments.find((item) => item.id === selectedId) ?? investments[0],
    [investments, selectedId]
  );

  const heroStats = [
    {
      key: "deployed",
      title: t("pages.investments.totalDeployed"),
      icon: PiggyBank,
      accent: "#10b981",
      value: formatPoolCurrency(totalAllocated),
    },
    {
      key: "apy",
      title: t("pages.investments.blendedApy"),
      icon: Percent,
      accent: "#38bdf8",
      value: `${poolSummary.poolApy}%`,
    },
    {
      key: "sleeves",
      title: t("pages.investments.allocationSleeves"),
      icon: Layers,
      accent: "#8b5cf6",
      value: String(investments.length),
    },
    {
      key: "growth",
      title: t("pages.investments.ytdGrowth"),
      icon: TrendingUp,
      accent: "#fbbf24",
      value: `+${poolSummary.ytdGrowthPct}%`,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.investments.title")}
        description={t("pages.investments.description")}
        highlights={t("pages.investments.highlights")}
        variant="hero"
      />

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
        {heroStats.map((stat) => (
          <HeroStatCard
            key={stat.key}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            accent={stat.accent}
          />
        ))}
      </section>

      <InvestmentInfographic
        investments={investments}
        totalAllocated={totalAllocated}
        poolApy={poolSummary.poolApy}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <InvestmentYieldChart
          selectedInvestment={selectedInvestment}
          blendedApy={poolSummary.poolApy}
        />

        <div className="dda-glass rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-medium text-white">{t("pages.investments.sleeveComparison")}</p>
          <p className="mt-1 text-xs text-gray-500">{t("pages.investments.sleeveComparisonSub")}</p>
          <ul className="mt-4 space-y-2">
            {[...investments]
              .sort((a, b) => b.allocated - a.allocated)
              .map((item, index) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        "dda-glass-btn flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition",
                        active && "border-emerald-400/25 ring-1 ring-emerald-400/15"
                      )}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-[#071013]"
                        style={{ backgroundColor: item.color }}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-white">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {t("pages.investments.riskLiquidity", {
                            risk: item.risk,
                            liquidity: item.liquidity,
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums text-emerald-400">
                          {item.returnPct}%
                        </span>
                        <span className="block text-[11px] tabular-nums text-gray-500">
                          {formatPoolCurrency(item.allocated)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      </div>

      <InvestmentHighlights highlights={investmentHighlights} />
    </div>
  );
}
