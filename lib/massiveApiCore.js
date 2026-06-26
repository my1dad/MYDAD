const DEFAULT_BASE = "https://api.massive.com";

export function resolveApiKey(env = process.env) {
  return env.MASSIVE_API_KEY || env.POLYGON_API_KEY || "";
}

export function resolveBaseUrl(env = process.env) {
  return env.MASSIVE_API_BASE_URL || DEFAULT_BASE;
}

async function fetchMassive(path, apiKey, baseUrl) {
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const body = await response.json().catch(() => ({}));
  const status = typeof body?.status === "string" ? body.status.toUpperCase() : "";
  if (!response.ok || status === "ERROR" || status === "NOT_AUTHORIZED") {
    const message =
      typeof body?.error === "string"
        ? body.error
        : typeof body?.message === "string"
          ? body.message
          : `Massive API error (${response.status})`;
    throw new Error(message);
  }

  return body;
}

function normalizePrevBar(symbol, bar) {
  const row = Array.isArray(bar) ? bar[0] : bar;
  if (!row || !Number.isFinite(row.c)) return null;
  return {
    symbol,
    price: row.c,
    change: 0,
    changePct: 0,
    open: row.o ?? null,
    high: row.h ?? null,
    low: row.l ?? null,
    close: row.c ?? null,
    prevClose: row.c ?? null,
    volume: row.v ?? null,
    vwap: row.vw ?? null,
    updatedAt: row.t ?? null,
    priceSource: "prev",
  };
}

function normalizeSnapshot(ticker, priceSource = "snapshot") {
  if (!ticker || typeof ticker !== "object") return null;

  const lastTrade = ticker.lastTrade ?? ticker.last_trade;
  const day = ticker.day;
  const prevDay = ticker.prevDay ?? ticker.prev_day;
  const lastPrice =
    lastTrade?.p ??
    lastTrade?.price ??
    day?.c ??
    prevDay?.c ??
    ticker.fmv ??
    null;

  if (!lastPrice || !Number.isFinite(lastPrice)) return null;

  const resolvedSource =
    lastTrade?.p != null || lastTrade?.price != null
      ? "last_trade"
      : day?.c != null
        ? "snapshot"
        : priceSource;

  return {
    symbol: ticker.ticker ?? ticker.T ?? "",
    price: lastPrice,
    change: ticker.todaysChange ?? ticker.todays_change ?? 0,
    changePct: ticker.todaysChangePerc ?? ticker.todays_change_perc ?? 0,
    open: day?.o ?? prevDay?.o ?? null,
    high: day?.h ?? prevDay?.h ?? null,
    low: day?.l ?? prevDay?.l ?? null,
    close: day?.c ?? prevDay?.c ?? null,
    prevClose: prevDay?.c ?? null,
    volume: day?.v ?? prevDay?.v ?? null,
    vwap: day?.vw ?? prevDay?.vw ?? null,
    updatedAt: ticker.updated ?? lastTrade?.t ?? null,
    priceSource: resolvedSource,
  };
}

function normalizeV3Snapshot(row) {
  if (!row || typeof row !== "object") return null;

  const lastTrade = row.last_trade ?? row.lastTrade;
  const session = row.session;
  const prevDay = row.prev_day ?? row.prevDay;
  const lastPrice =
    lastTrade?.price ??
    lastTrade?.p ??
    session?.close ??
    prevDay?.close ??
    prevDay?.c ??
    null;

  if (!Number.isFinite(lastPrice)) return null;

  const resolvedSource =
    lastTrade?.price != null || lastTrade?.p != null
      ? "last_trade"
      : session?.close != null
        ? "snapshot"
        : "prev";

  return {
    symbol: row.ticker ?? "",
    price: lastPrice,
    change: session?.change ?? 0,
    changePct: session?.change_percent ?? session?.changePercent ?? 0,
    open: session?.open ?? prevDay?.open ?? prevDay?.o ?? null,
    high: session?.high ?? prevDay?.high ?? prevDay?.h ?? null,
    low: session?.low ?? prevDay?.low ?? prevDay?.l ?? null,
    close: session?.close ?? prevDay?.close ?? prevDay?.c ?? null,
    prevClose: prevDay?.close ?? prevDay?.c ?? null,
    volume: session?.volume ?? prevDay?.volume ?? prevDay?.v ?? null,
    vwap: session?.vwap ?? prevDay?.vwap ?? prevDay?.vw ?? null,
    updatedAt: lastTrade?.sip_timestamp ?? lastTrade?.t ?? row.updated ?? null,
    priceSource: resolvedSource,
  };
}

export async function fetchSnapshotForSymbol(symbol, apiKey, baseUrl) {
  // Prefer live/delayed intraday sources first; prev-day close is only a Basic-plan fallback.
  const fallbacks = [
    async () => {
      const payload = await fetchMassive(
        `/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`,
        apiKey,
        baseUrl,
      );
      return normalizeSnapshot(payload.ticker, "snapshot");
    },
    async () => {
      const searchPath = new URL("/v3/snapshot", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
      searchPath.searchParams.set("ticker.any_of", symbol);
      const payload = await fetchMassive(
        `${searchPath.pathname}${searchPath.search}`,
        apiKey,
        baseUrl,
      );
      return normalizeV3Snapshot(payload.results?.[0]);
    },
    async () => {
      const payload = await fetchMassive(
        `/v2/last/trade/${encodeURIComponent(symbol)}`,
        apiKey,
        baseUrl,
      );
      const trade = payload.results;
      const price = trade?.p ?? trade?.price;
      if (!Number.isFinite(price)) return null;
      return {
        symbol,
        price,
        change: 0,
        changePct: 0,
        open: null,
        high: null,
        low: null,
        close: price,
        prevClose: null,
        volume: trade?.s ?? trade?.size ?? null,
        vwap: null,
        updatedAt: trade?.t ?? trade?.sip_timestamp ?? null,
        priceSource: "last_trade",
      };
    },
    async () => {
      const payload = await fetchMassive(
        `/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev`,
        apiKey,
        baseUrl,
      );
      return normalizePrevBar(symbol, payload.results);
    },
  ];

  let lastError = null;
  for (const attempt of fallbacks) {
    try {
      const snapshot = await attempt();
      if (snapshot) return snapshot;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`No quote data for ${symbol}`);
}

export async function fetchSnapshotsForSymbols(symbols, apiKey, baseUrl) {
  if (!symbols.length) return [];

  if (symbols.length === 1) {
    try {
      return [await fetchSnapshotForSymbol(symbols[0], apiKey, baseUrl)];
    } catch {
      return [];
    }
  }

  try {
    const searchPath = new URL("/v3/snapshot", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    searchPath.searchParams.set("ticker.any_of", symbols.join(","));
    searchPath.searchParams.set("limit", String(Math.min(symbols.length, 50)));
    const payload = await fetchMassive(
      `${searchPath.pathname}${searchPath.search}`,
      apiKey,
      baseUrl,
    );

    const bySymbol = new Map(
      (payload.results ?? [])
        .map((row) => normalizeV3Snapshot(row))
        .filter(Boolean)
        .map((snap) => [snap.symbol.toUpperCase(), snap]),
    );

    const snapshots = [];
    const missing = [];
    for (const symbol of symbols) {
      const snap = bySymbol.get(symbol);
      if (snap) snapshots.push(snap);
      else missing.push(symbol);
    }

    if (missing.length) {
      const extras = await Promise.all(
        missing.map(async (symbol) => {
          try {
            return await fetchSnapshotForSymbol(symbol, apiKey, baseUrl);
          } catch {
            return null;
          }
        }),
      );
      snapshots.push(...extras.filter(Boolean));
    }

    return snapshots;
  } catch {
    return (
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            return await fetchSnapshotForSymbol(symbol, apiKey, baseUrl);
          } catch {
            return null;
          }
        }),
      )
    ).filter(Boolean);
  }
}

export async function handleMarketApiRequest(pathname, searchParams, env = process.env) {
  const apiKey = resolveApiKey(env);
  const baseUrl = resolveBaseUrl(env);

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: "Massive API key not configured. Set MASSIVE_API_KEY in your environment.",
        docs: "https://massive.com/dashboard/account",
      },
    };
  }

  if (pathname === "/api/market/snapshot") {
    const symbol = searchParams.get("symbol")?.trim().toUpperCase();
    if (!symbol) return { status: 400, body: { error: "symbol required" } };

    const snapshot = await fetchSnapshotForSymbol(symbol, apiKey, baseUrl);
    return { status: 200, body: { snapshot, status: "OK" } };
  }

  if (pathname === "/api/market/snapshots") {
    const tickers = searchParams
      .get("tickers")
      ?.split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    if (!tickers?.length) return { status: 400, body: { error: "tickers required" } };

    const snapshots = await fetchSnapshotsForSymbols(tickers, apiKey, baseUrl);

    return { status: 200, body: { snapshots, count: snapshots.length, status: "OK" } };
  }

  if (pathname === "/api/market/tickers/search") {
    const query = searchParams.get("q")?.trim();
    if (!query) return { status: 200, body: { tickers: [], count: 0, status: "OK" } };

    const limit = Math.min(
      20,
      Math.max(1, Number.parseInt(searchParams.get("limit") ?? "12", 10) || 12),
    );

    const searchPath = new URL("/v3/reference/tickers", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    searchPath.searchParams.set("search", query);
    searchPath.searchParams.set("market", "stocks");
    searchPath.searchParams.set("active", "true");
    searchPath.searchParams.set("limit", String(limit));
    searchPath.searchParams.set("sort", "ticker");
    searchPath.searchParams.set("order", "asc");

    const payload = await fetchMassive(
      `${searchPath.pathname}${searchPath.search}`,
      apiKey,
      baseUrl,
    );

    const tickers = (payload.results ?? []).map((item) => ({
      symbol: item.ticker ?? "",
      name: item.name ?? item.ticker ?? "",
      type: item.type ?? "",
      primaryExchange: item.primary_exchange ?? "",
      market: item.market ?? "stocks",
      active: item.active ?? true,
    }));

    return {
      status: 200,
      body: { tickers, count: tickers.length, status: payload.status ?? "OK" },
    };
  }

  if (pathname.startsWith("/api/market/ticker/")) {
    const symbol = decodeURIComponent(pathname.slice("/api/market/ticker/".length))
      .trim()
      .toUpperCase();
    if (!symbol) return { status: 400, body: { error: "symbol required" } };

    const payload = await fetchMassive(
      `/v3/reference/tickers/${encodeURIComponent(symbol)}`,
      apiKey,
      baseUrl,
    );

    const result = payload.results ?? {};
    return {
      status: 200,
      body: {
        ticker: {
          symbol: result.ticker ?? symbol,
          name: result.name ?? symbol,
          market: result.market ?? "stocks",
          type: result.type ?? "",
          description: result.description ?? "",
          homepage: result.homepage_url ?? "",
          marketCap: result.market_cap ?? null,
          primaryExchange: result.primary_exchange ?? "",
          currency: result.currency_name ?? "USD",
        },
        status: payload.status ?? "OK",
      },
    };
  }

  return { status: 404, body: { error: "Not found" } };
}
