import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";

function StatCell({ label, value, accent, subValue }) {
  return (
    <div className="dda-panel rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn("mt-1 text-sm font-bold tabular-nums", accent ?? "text-white")}>{value}</p>
      {subValue ? <p className="mt-0.5 text-[10px] tabular-nums text-gray-500">{subValue}</p> : null}
    </div>
  );
}

export default function AllocationStatsGrid({
  allocated,
  apy,
  liquidity,
  roiAmount = 0,
  roiPct = 0,
  t,
}) {
  const roiPositive = roiAmount >= 0;
  const roiAccent = roiPositive ? "text-dda-green-light" : "text-red-400";
  const roiSign = roiPositive ? "+" : "";

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCell
        label={t("investmentChart.allocated")}
        value={formatPoolCurrency(allocated)}
      />
      <StatCell
        label={t("investmentChart.apy")}
        value={`${apy}%`}
        accent="text-dda-green-light"
      />
      <StatCell label={t("investmentChart.liquidity")} value={liquidity} />
      <StatCell
        label={t("investmentChart.roi")}
        value={`${roiSign}${formatPoolCurrency(roiAmount)}`}
        accent={roiAccent}
        subValue={`${roiSign}${Number(roiPct).toFixed(2)}%`}
      />
    </div>
  );
}
