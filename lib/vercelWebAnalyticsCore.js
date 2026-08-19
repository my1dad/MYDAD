export const DAD_VERCEL_PROJECT_ID = "prj_Bnq7CP587BYcn8LqCOIkYnmzJe2r";
export const DAD_VERCEL_TEAM_ID = "team_IVNBcd2tFVDDvDoaqHlwiJOT";
export const DAD_VERCEL_ANALYTICS_URL =
  "https://vercel.com/my-dollar-a-day-server/dad/analytics";

const RANGE_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function resolveAnalyticsRange(raw) {
  return RANGE_MS[raw] ? raw : "7d";
}

function resolveToken(env) {
  return String(env?.VERCEL_API_TOKEN ?? env?.VERCEL_TOKEN ?? "").trim();
}

function resolveIds(env) {
  return {
    projectId: String(env?.VERCEL_PROJECT_ID ?? DAD_VERCEL_PROJECT_ID).trim(),
    teamId: String(env?.VERCEL_ORG_ID ?? DAD_VERCEL_TEAM_ID).trim(),
  };
}

function rangeWindow(range) {
  const until = new Date();
  const since = new Date(until.getTime() - (RANGE_MS[range] ?? RANGE_MS["7d"]));
  return { since: since.toISOString(), until: until.toISOString() };
}

async function queryVisits(env, path, params) {
  const token = resolveToken(env);
  const { projectId, teamId } = resolveIds(env);
  const qs = new URLSearchParams({ projectId, teamId, ...params });
  const res = await fetch(`https://api.vercel.com/v1/query/web-analytics/${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.message || body?.message || `Analytics ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function asRows(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function asTotals(payload) {
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : {};
  return {
    visitors: Number(data.visitors) || 0,
    pageviews: Number(data.pageviews) || 0,
  };
}

function dimensionRows(rows, key) {
  return rows
    .map((row) => {
      const label = String(row?.[key] ?? "").trim() || "Direct";
      return {
        label,
        pageviews: Number(row?.pageviews) || 0,
        visitors: Number(row?.visitors) || 0,
      };
    })
    .filter((row) => row.pageviews > 0 || row.visitors > 0)
    .sort((a, b) => b.pageviews - a.pageviews || b.visitors - a.visitors);
}

export async function fetchVercelWebAnalytics(env, rangeInput = "7d") {
  const token = resolveToken(env);
  if (!token) {
    const err = new Error("Missing VERCEL_API_TOKEN");
    err.status = 503;
    err.code = "MISSING_TOKEN";
    throw err;
  }

  const range = resolveAnalyticsRange(rangeInput);
  const { since, until } = rangeWindow(range);
  const byTime = range === "24h" ? "hour" : "day";
  const base = { since, until };

  const settled = await Promise.allSettled([
    queryVisits(env, "visits/count", base),
    queryVisits(env, "visits/aggregate", { ...base, by: byTime }),
    queryVisits(env, "visits/aggregate", { ...base, by: "requestPath", limit: "8" }),
    queryVisits(env, "visits/aggregate", { ...base, by: "referrerHostname", limit: "8" }),
    queryVisits(env, "visits/aggregate", { ...base, by: "country", limit: "8" }),
    queryVisits(env, "visits/aggregate", { ...base, by: "deviceType", limit: "6" }),
    queryVisits(env, "visits/aggregate", { ...base, by: "browserName", limit: "6" }),
  ]);

  const value = (index, fallback) =>
    settled[index].status === "fulfilled" ? settled[index].value : fallback;

  const hourFailed = settled[1].status === "rejected" && byTime === "hour";
  const timeseriesPayload = hourFailed
    ? await queryVisits(env, "visits/aggregate", { ...base, by: "day" }).catch(() => ({ data: [] }))
    : value(1, { data: [] });

  const firstError = settled.find((item) => item.status === "rejected")?.reason;
  if (settled[0].status === "rejected" && settled[1].status === "rejected") {
    throw firstError;
  }

  return {
    range,
    since,
    until,
    dashboardUrl: DAD_VERCEL_ANALYTICS_URL,
    totals: asTotals(value(0, { data: { visitors: 0, pageviews: 0 } })),
    timeseries: asRows(timeseriesPayload).map((row) => ({
      timestamp: row.timestamp || row.day || row.hour || "",
      pageviews: Number(row.pageviews) || 0,
      visitors: Number(row.visitors) || 0,
    })),
    pages: dimensionRows(asRows(value(2, { data: [] })), "requestPath"),
    referrers: dimensionRows(asRows(value(3, { data: [] })), "referrerHostname"),
    countries: dimensionRows(asRows(value(4, { data: [] })), "country"),
    devices: dimensionRows(asRows(value(5, { data: [] })), "deviceType"),
    browsers: dimensionRows(asRows(value(6, { data: [] })), "browserName"),
  };
}
