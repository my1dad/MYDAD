export const REPORT_PERIOD_FILTERS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "all", label: "All time" },
];

/** Portfolio velocity trend (mock weekly completion %) */
export const PORTFOLIO_VELOCITY = [
  { week: "W1", progress: 42 },
  { week: "W2", progress: 48 },
  { week: "W3", progress: 51 },
  { week: "W4", progress: 55 },
  { week: "W5", progress: 58 },
  { week: "W6", progress: 62 },
  { week: "W7", progress: 65 },
];

export const STATUS_CHART_COLORS = {
  onTrack: "#10b981",
  atRisk: "#f59e0b",
  onHold: "#ef4444",
  gettingStarted: "#94a3b8",
};
