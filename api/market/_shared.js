import { handleMarketApiRequest } from "../../lib/massiveApiCore.js";

export async function runMarketHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const { status, body } = await handleMarketApiRequest(url.pathname, url.searchParams);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  } catch (err) {
    console.error("[massive-api]", err);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: err?.message ?? "Market data unavailable" }));
  }
}
