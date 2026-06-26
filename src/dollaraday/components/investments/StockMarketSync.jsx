import { useEffect, useMemo } from "react";
import { useAllocationPositions } from "../../lib/allocationPositions";
import { isStockPosition, syncStockMarketPrices } from "../../lib/stockAllocations";
import { useStockQuotes } from "../../hooks/useStockMarketData";

/** Keeps stock position market prices in sync with Massive across the dashboard. */
export default function StockMarketSync() {
  const positions = useAllocationPositions();
  const stockSymbols = useMemo(
    () =>
      positions
        .filter((position) => isStockPosition(position) && !position.matured)
        .map((position) => position.marketSymbol ?? position.contractId),
    [positions],
  );

  const { quotes } = useStockQuotes(stockSymbols, stockSymbols.length > 0);
  const fingerprint = useMemo(
    () =>
      Object.entries(quotes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([symbol, quote]) => `${symbol}:${quote.price}`)
        .join("|"),
    [quotes],
  );

  useEffect(() => {
    if (!fingerprint) return;
    syncStockMarketPrices(quotes);
  }, [fingerprint, quotes]);

  return null;
}
