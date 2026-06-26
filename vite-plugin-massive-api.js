import { loadEnv } from "vite";
import { handleMarketApiRequest } from "./lib/massiveApiCore.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export function massiveApiPlugin() {
  function attachMarketMiddleware(server, env) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/market")) return next();
      if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

      try {
        const url = new URL(req.url, "http://localhost");
        const { status, body } = await handleMarketApiRequest(url.pathname, url.searchParams, env);
        return sendJson(res, status, body);
      } catch (err) {
        console.error("[massive-api]", err);
        return sendJson(res, 502, { error: err?.message ?? "Market data unavailable" });
      }
    });
  }

  return {
    name: "massive-api",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      attachMarketMiddleware(server, env);
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      attachMarketMiddleware(server, env);
    },
  };
}
