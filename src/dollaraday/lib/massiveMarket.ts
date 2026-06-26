export interface StockTickerSearchResult {
  symbol: string;
  name: string;
  type: string;
  primaryExchange: string;
  market: string;
  active: boolean;
}

export interface StockMarketSnapshot {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  prevClose: number | null;
  volume: number | null;
  vwap: number | null;
  updatedAt: number | null;
  /** Where the price came from: prev = prior close (Basic plan), snapshot, last_trade */
  priceSource?: "prev" | "snapshot" | "last_trade" | "v3_snapshot";
}

export interface StockTickerDetails {
  symbol: string;
  name: string;
  market: string;
  type: string;
  description: string;
  homepage: string;
  marketCap: number | null;
  primaryExchange: string;
  currency: string;
}

export function formatQuotePrice(price: number, currency = "USD"): string {
  if (!Number.isFinite(price)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatQuoteChange(change: number, changePct: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
}

export async function searchStockTickers(
  query: string,
  limit = 12,
): Promise<StockTickerSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const response = await fetch(
    `/api/market/tickers/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to search tickers");
  }
  return payload.tickers as StockTickerSearchResult[];
}

export async function fetchStockSnapshot(symbol: string): Promise<StockMarketSnapshot> {
  const response = await fetch(`/api/market/snapshot?symbol=${encodeURIComponent(symbol)}`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? `Unable to load ${symbol} quote`);
  }
  return payload.snapshot as StockMarketSnapshot;
}

export async function fetchStockSnapshots(symbols: string[]): Promise<StockMarketSnapshot[]> {
  if (!symbols.length) return [];
  const response = await fetch(
    `/api/market/snapshots?tickers=${encodeURIComponent(symbols.join(","))}`,
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? "Unable to load stock quotes");
  }
  return payload.snapshots as StockMarketSnapshot[];
}

export async function fetchStockTickerDetails(symbol: string): Promise<StockTickerDetails | null> {
  const response = await fetch(`/api/market/ticker/${encodeURIComponent(symbol)}`);
  const payload = await response.json();
  if (!response.ok) return null;
  return payload.ticker as StockTickerDetails;
}

export function computeStockPositionMetrics(
  shares: number,
  entryPrice: number,
  marketPrice: number,
) {
  const costBasis = shares * entryPrice;
  const marketValue = shares * marketPrice;
  const pnl = marketValue - costBasis;
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return {
    costBasis: roundMoney(costBasis),
    marketValue: roundMoney(marketValue),
    pnl: roundMoney(pnl),
    pnlPct: roundMoney(pnlPct),
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundShares(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function isValidTickerSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(normalized);
}
