/** Brand palette — green primary, gold accent (logo). Member default. */
export const DDA_THEME = {
  bg: "#071013",
  ink: "#071013",
  green: "#10b981",
  greenLight: "#34d399",
  greenSoft: "#6ee7b7",
  lime: "#84cc16",
  limeLight: "#a3e635",
  limeBright: "#bef264",
  gold: "#d4a012",
  goldLight: "#fbbf24",
  goldSoft: "#fcd34d",
  goldDeep: "#b45309",
};

/** Master admin palette — cool blues only (mirrors CSS `.dda-app--admin`). */
export const DDA_THEME_ADMIN = {
  bg: "#060c18",
  ink: "#060c18",
  green: "#2563eb",
  greenLight: "#60a5fa",
  greenSoft: "#93c5fd",
  lime: "#0ea5e9",
  limeLight: "#38bdf8",
  limeBright: "#7dd3fc",
  gold: "#0284c7",
  goldLight: "#7dd3fc",
  goldSoft: "#bae6fd",
  goldDeep: "#0369a1",
};

/** CSS custom properties — resolve to member green or admin blue via theme class. */
export const DDA_THEME_VARS = {
  bg: "var(--color-dda-bg)",
  ink: "var(--color-dda-ink)",
  green: "var(--color-dda-green)",
  greenLight: "var(--color-dda-green-light)",
  greenSoft: "var(--color-dda-green-soft)",
  lime: "var(--color-dda-lime)",
  limeLight: "var(--color-dda-lime-light)",
  limeBright: "var(--color-dda-lime-bright)",
  gold: "var(--color-dda-gold)",
  goldLight: "var(--color-dda-gold-light)",
  goldSoft: "var(--color-dda-gold-soft)",
  goldDeep: "var(--color-dda-gold-deep)",
};

export function getDadTheme(isAdmin = false) {
  return isAdmin ? DDA_THEME_ADMIN : DDA_THEME;
}

export const DDA_CHART = {
  primary: DDA_THEME_VARS.greenLight,
  secondary: DDA_THEME_VARS.goldLight,
  grid: "#6b7280",
  tooltipBg: "rgba(7, 16, 19, 0.95)",
};

/** Deployed / escrow / available — used on Liquidity Pool capital allocation visuals. */
export const POOL_CAPITAL_COLORS = {
  deployed: DDA_THEME_VARS.greenLight,
  escrow: "#38bdf8",
  available: DDA_THEME_VARS.goldLight,
};
