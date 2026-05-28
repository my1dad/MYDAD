export const SHAPE_FILL_OPACITY = 0.5;

export const SHAPE_COLORS = [
  { id: "violet", label: "Violet", base: "#ddd6fe", strokeBase: "#a78bfa", swatch: "#ddd6fe" },
  { id: "blue", label: "Blue", base: "#bfdbfe", strokeBase: "#60a5fa", swatch: "#bfdbfe" },
  { id: "sky", label: "Sky", base: "#bae6fd", strokeBase: "#38bdf8", swatch: "#bae6fd" },
  { id: "green", label: "Green", base: "#bbf7d0", strokeBase: "#4ade80", swatch: "#bbf7d0" },
  { id: "emerald", label: "Emerald", base: "#a7f3d0", strokeBase: "#34d399", swatch: "#a7f3d0" },
  { id: "yellow", label: "Yellow", base: "#fef08a", strokeBase: "#facc15", swatch: "#fef08a" },
  { id: "amber", label: "Amber", base: "#fde68a", strokeBase: "#fbbf24", swatch: "#fde68a" },
  { id: "orange", label: "Orange", base: "#fed7aa", strokeBase: "#fb923c", swatch: "#fed7aa" },
  { id: "red", label: "Red", base: "#fecaca", strokeBase: "#f87171", swatch: "#fecaca" },
  { id: "pink", label: "Pink", base: "#fbcfe8", strokeBase: "#f472b6", swatch: "#fbcfe8" },
  { id: "rose", label: "Rose", base: "#fecdd3", strokeBase: "#fb7185", swatch: "#fecdd3" },
  { id: "slate", label: "Slate", base: "#e2e8f0", strokeBase: "#94a3b8", swatch: "#e2e8f0" },
];

export const SHAPE_COLOR_IDS = SHAPE_COLORS.map((color) => color.id);
export const DEFAULT_SHAPE_FILL = "violet";

function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getShapeColor(colorId) {
  const color = SHAPE_COLORS.find((entry) => entry.id === colorId) ?? SHAPE_COLORS[0];
  return {
    ...color,
    fill: hexToRgba(color.base, SHAPE_FILL_OPACITY),
    stroke: hexToRgba(color.strokeBase, SHAPE_FILL_OPACITY),
  };
}
