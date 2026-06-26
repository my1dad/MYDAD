import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchStockSnapshot,
  fetchStockSnapshots,
  fetchStockTickerDetails,
  searchStockTickers,
  type StockMarketSnapshot,
  type StockTickerDetails,
  type StockTickerSearchResult,
} from "../lib/massiveMarket";

const QUOTE_REFRESH_MS = 15_000;

let quotesSnapshot: Record<string, StockMarketSnapshot> = {};
let quotesSnapshotKey = "";

function stabilizeQuotes(next: Record<string, StockMarketSnapshot>): Record<string, StockMarketSnapshot> {
  const key = Object.entries(next)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, quote]) =>
      `${symbol}:${quote.price}:${quote.change}:${quote.changePct}:${quote.updatedAt ?? ""}`,
    )
    .join("|");
  if (key === quotesSnapshotKey) return quotesSnapshot;
  quotesSnapshotKey = key;
  quotesSnapshot = next;
  return quotesSnapshot;
}

export function useStockQuote(symbol: string | null, enabled = true) {
  const [quote, setQuote] = useState<StockMarketSnapshot | null>(null);
  const [details, setDetails] = useState<StockTickerDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quoteRef = useRef<StockMarketSnapshot | null>(null);

  useEffect(() => {
    quoteRef.current = quote;
  }, [quote]);

  const load = useCallback(
    async (options?: { manual?: boolean }) => {
      const normalized = symbol?.trim().toUpperCase();
      if (!normalized) return null;

      if (options?.manual) {
        setRefreshing(true);
      } else {
        setLoading((current) => (quoteRef.current ? current : true));
      }
      setError(null);

      try {
        const [snapshot, tickerDetails] = await Promise.all([
          fetchStockSnapshot(normalized),
          fetchStockTickerDetails(normalized),
        ]);
        setQuote(snapshot);
        setDetails(tickerDetails);
        return snapshot;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Quote unavailable");
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [symbol],
  );

  useEffect(() => {
    if (!enabled || !symbol) {
      setQuote(null);
      setDetails(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return undefined;
    }

    let alive = true;

    const run = async () => {
      if (!alive) return;
      await load();
    };

    run();
    const timer = window.setInterval(run, QUOTE_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [symbol, enabled, load]);

  const refresh = useCallback(async () => load({ manual: true }), [load]);

  return { quote, details, loading, refreshing, error, refresh };
}

export function useStockQuotes(symbols: string[], enabled = true) {
  const [quotes, setQuotes] = useState<Record<string, StockMarketSnapshot>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useMemo(() => [...new Set(symbols.map((item) => item.toUpperCase()))].sort().join(","), [symbols]);
  const quotesRef = useRef(quotes);

  useEffect(() => {
    quotesRef.current = quotes;
  }, [quotes]);

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!enabled || !list.length) {
      setQuotes({});
      setError(null);
      setLoading(false);
      return undefined;
    }

    let alive = true;

    const load = async () => {
      setLoading((current) => (Object.keys(quotesRef.current).length ? current : true));
      setError(null);
      try {
        const snapshots = await fetchStockSnapshots(list);
        if (!alive) return;
        const next: Record<string, StockMarketSnapshot> = {};
        snapshots.forEach((snapshot: StockMarketSnapshot) => {
          next[snapshot.symbol.toUpperCase()] = snapshot;
        });
        setQuotes(stabilizeQuotes(next));
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Quotes unavailable");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, QUOTE_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [key, enabled]);

  return { quotes, loading, error };
}

export function useStockTickerSearch(query: string, enabled = true) {
  const [results, setResults] = useState<StockTickerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < 1) {
      setResults([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(async () => {
      try {
        const tickers = await searchStockTickers(trimmed);
        if (!alive) return;
        setResults(tickers);
      } catch (err) {
        if (!alive) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Search unavailable");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, enabled]);

  return { results, loading, error };
}
