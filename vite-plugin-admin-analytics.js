import { loadEnv } from "vite";
import { fetchVercelWebAnalytics, resolveAnalyticsRange } from "./lib/vercelWebAnalyticsCore.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export function adminAnalyticsPlugin() {
  function attach(server, env) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/admin-analytics")) return next();
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

      try {
        const url = new URL(req.url, "http://localhost");
        const range = resolveAnalyticsRange(url.searchParams.get("range"));
        const payload = await fetchVercelWebAnalytics(env, range);
        return sendJson(res, 200, payload);
      } catch (err) {
        console.error("[admin-analytics]", err);
        return sendJson(res, Number(err?.status) || 502, {
          error: err?.message ?? "Failed to load Vercel analytics",
          code: err?.code ?? "ANALYTICS_FAILED",
        });
      }
    });
  }

  return {
    name: "admin-analytics",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      attach(server, { ...process.env, ...env });
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      attach(server, { ...process.env, ...env });
    },
  };
}
