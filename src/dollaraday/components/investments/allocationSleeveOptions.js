import { BarChart3, Landmark, LineChart } from "lucide-react";

export const ALLOCATION_SLEEVE_OPTIONS = [
  {
    id: "treasury",
    labelKey: "buyTreasury",
    descKey: "buyTreasuryDesc",
    icon: Landmark,
    accent: "var(--color-dda-green-light)",
  },
  {
    id: "bonds",
    labelKey: "buyBonds",
    descKey: "buyBondsDesc",
    icon: LineChart,
    accent: "#8b5cf6",
  },
  {
    id: "stocks",
    labelKey: "buyStocks",
    descKey: "buyStocksDesc",
    icon: BarChart3,
    accent: "#38bdf8",
  },
];

export function getAllocationSleeveOption(sleeveId) {
  return ALLOCATION_SLEEVE_OPTIONS.find((item) => item.id === sleeveId);
}
