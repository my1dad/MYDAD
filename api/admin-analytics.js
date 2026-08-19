import {
  fetchVercelWebAnalytics,
  resolveAnalyticsRange,
} from "../lib/vercelWebAnalyticsCore.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const url = new URL(req.url || "/", "http://localhost");
    const range = resolveAnalyticsRange(url.searchParams.get("range"));
    const payload = await fetchVercelWebAnalytics(process.env, range);
    res.statusCode = 200;
    res.end(JSON.stringify(payload));
  } catch (err) {
    const status = Number(err?.status) || 502;
    res.statusCode = status;
    res.end(
      JSON.stringify({
        error: err?.message ?? "Failed to load Vercel analytics",
        code: err?.code ?? "ANALYTICS_FAILED",
      }),
    );
  }
}
