import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPoolCurrency } from "../../data/mockData";
import { useStockQuote, useStockQuotes, useStockTickerSearch } from "../../hooks/useStockMarketData";
import { useLocale } from "../../i18n/LocaleContext";
import { buyStockAllocation, isStockPosition, sellStockAllocation, syncStockMarketPrices } from "../../lib/stockAllocations";
import {
  computeStockPositionMetrics,
  formatQuoteChange,
  formatQuotePrice,
  isValidTickerSymbol,
  roundShares,
} from "../../lib/massiveMarket";
import { useAllocationPositions } from "../../lib/allocationPositions";
import { resolveMemberProfileId } from "../../lib/memberAccounts";

function parseShares(value) {
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function QuoteStat({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-black/25 px-3 py-2 ring-1 ring-white/8">
      <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", accent ?? "text-white")}>{value}</p>
    </div>
  );
}

function extractTickerFromQuery(value) {
  const token = value.trim().toUpperCase().split(/[\s·,|/]+/)[0] ?? "";
  return isValidTickerSymbol(token) ? token : "";
}

export default function StockAllocationModal({
  sleeve,
  open,
  availableBalance,
  onClose,
  initialMode = "buy",
  initialSellPositionId = "",
}) {
  const { t } = useLocale();
  const profileId = resolveMemberProfileId();
  const positions = useAllocationPositions(profileId);
  const openStockPositions = useMemo(
    () => positions.filter((position) => isStockPosition(position) && !position.matured),
    [positions],
  );

  const [mode, setMode] = useState("buy");
  const [symbolQuery, setSymbolQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [shares, setShares] = useState("");
  const [sellShares, setSellShares] = useState("");
  const [sellPositionId, setSellPositionId] = useState("");
  const [error, setError] = useState("");
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  const searchActive =
    open && mode === "buy" && symbolQuery.trim().length > 0 && !selectedSymbol;

  const { results: searchResults, loading: searchLoading, error: searchError } = useStockTickerSearch(
    symbolQuery,
    searchActive,
  );

  const { quote, details, loading: quoteLoading, error: quoteError } = useStockQuote(
    selectedSymbol || null,
    open,
  );

  const positionSymbols = useMemo(
    () => openStockPositions.map((position) => position.marketSymbol ?? position.contractId),
    [openStockPositions],
  );
  const { quotes: positionQuotes, loading: positionsLoading } = useStockQuotes(positionSymbols, open);
  const positionQuotesFingerprint = useMemo(
    () =>
      Object.entries(positionQuotes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([symbol, quote]) => `${symbol}:${quote.price}`)
        .join("|"),
    [positionQuotes],
  );

  useEffect(() => {
    if (!open || !positionQuotesFingerprint) return;
    syncStockMarketPrices(positionQuotes);
  }, [open, positionQuotesFingerprint, positionQuotes]);

  useEffect(() => {
    if (!open) return undefined;
    setMode(initialMode);
    setSymbolQuery("");
    setSelectedSymbol("");
    setSearchFocused(false);
    setShares("");
    setSellShares("");
    setSellPositionId(initialSellPositionId);
    setError("");
  }, [open, initialMode, initialSellPositionId]);

  useEffect(() => {
    if (!open || mode !== "buy") return undefined;
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      setSearchFocused(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "buy") return undefined;

    const handlePointerDown = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) {
        setSearchFocused(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const parsedShares = parseShares(shares);
  const livePrice = quote?.price ?? 0;
  const orderTotal = parsedShares > 0 && livePrice > 0 ? roundShares(parsedShares * livePrice) : 0;

  const sellPosition = openStockPositions.find((position) => position.id === sellPositionId) ?? null;
  const sellSymbol = sellPosition?.marketSymbol ?? sellPosition?.contractId ?? "";
  const sellQuote = sellSymbol ? positionQuotes[sellSymbol.toUpperCase()] : null;
  const sellPrice = sellQuote?.price ?? sellPosition?.marketPrice ?? sellPosition?.entryPrice ?? 0;
  const parsedSellShares = parseShares(sellShares);
  const sellEntry =
    sellPosition?.entryPrice ??
    (sellPosition && sellPosition.contracts > 0
      ? sellPosition.principal / sellPosition.contracts
      : 0);
  const sellMetrics = sellPosition
    ? computeStockPositionMetrics(
        parsedSellShares > 0 ? parsedSellShares : sellPosition.contracts,
        sellEntry,
        sellPrice,
      )
    : null;
  const sellProceeds =
    parsedSellShares > 0 && sellPrice > 0 ? roundShares(parsedSellShares * sellPrice) : 0;
  const sellSharesExceedsHoldings =
    sellPosition != null && parsedSellShares > sellPosition.contracts + 0.00001;

  const canBuy = Boolean(selectedSymbol && parsedShares > 0 && livePrice > 0);
  const canSell = Boolean(
    sellPosition &&
      sellPrice > 0 &&
      parsedSellShares > 0 &&
      !sellSharesExceedsHoldings,
  );

  useEffect(() => {
    if (!open || mode !== "sell" || !sellPositionId) return;
    const position = openStockPositions.find((item) => item.id === sellPositionId);
    if (!position) return;
    setSellShares(String(position.contracts));
  }, [open, mode, sellPositionId, openStockPositions]);

  if (!open) return null;

  const handleBuy = () => {
    setError("");
    const result = buyStockAllocation({
      symbol: selectedSymbol,
      shares: parsedShares,
      price: livePrice,
      label: details?.name ?? selectedSymbol,
    });

    if (result === "invalid") {
      setError(t("pages.investments.buyInvalid"));
      return;
    }
    if (result === "insufficient") {
      setError(t("pages.investments.buyInsufficient"));
      return;
    }
    onClose();
  };

  const handleSell = () => {
    setError("");
    if (!sellPosition) return;

    if (sellSharesExceedsHoldings) {
      setError(t("pages.investments.stockSellExceedsShares"));
      return;
    }

    const result = sellStockAllocation({
      positionId: sellPosition.id,
      exitPrice: sellPrice,
      shares: parsedSellShares,
    });

    if (result === "not_found") {
      setError(t("pages.investments.stockSellNotFound"));
      return;
    }
    if (result === "invalid") {
      setError(t("pages.investments.stockSellInvalid"));
      return;
    }
    onClose();
  };

  const adjustSellShares = (delta) => {
    if (!sellPosition) return;
    const current = parseShares(sellShares) || 0;
    const next = Math.max(0, Math.min(sellPosition.contracts, roundShares(current + delta)));
    setSellShares(next > 0 ? String(next) : "");
    setError("");
  };

  const setSellAllShares = () => {
    if (!sellPosition) return;
    setSellShares(String(sellPosition.contracts));
    setError("");
  };

  const adjustShares = (delta) => {
    const current = parseShares(shares) || 0;
    const next = Math.max(0, roundShares(current + delta));
    setShares(next > 0 ? String(next) : "");
    setError("");
  };

  const changePositive = (quote?.change ?? 0) >= 0;
  const showSearchResults =
    searchFocused && symbolQuery.trim().length > 0 && !selectedSymbol;

  const pickSearchResult = (item) => {
    setSelectedSymbol(item.symbol);
    setSymbolQuery(item.symbol);
    setSearchFocused(false);
    setError("");
  };

  const commitSymbolQuery = () => {
    const exact = searchResults.find(
      (item) => item.symbol.toUpperCase() === symbolQuery.trim().toUpperCase(),
    );
    if (exact) {
      pickSearchResult(exact);
      return;
    }
    if (searchResults.length === 1) {
      pickSearchResult(searchResults[0]);
      return;
    }
    const ticker = extractTickerFromQuery(symbolQuery);
    if (ticker) {
      setSelectedSymbol(ticker);
      setSymbolQuery(ticker);
      setSearchFocused(false);
      setError("");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("pages.investments.buyCloseModal")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-stocks-title"
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset"
              style={{
                backgroundColor: "color-mix(in srgb, #38bdf8 14%, transparent)",
                color: "#38bdf8",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, #38bdf8 28%, transparent)",
              }}
            >
              <BarChart3 className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
                {t("pages.investments.buyAllocationsTitle")}
              </p>
              <h2 id="buy-stocks-title" className="mt-1 text-lg font-semibold text-white">
                {t(`pages.investments.${sleeve.labelKey}`)}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{t(`pages.investments.${sleeve.descKey}`)}</p>
              <p className="mt-1 text-[11px] text-gray-600">
                {quote?.priceSource === "prev"
                  ? t("pages.investments.stockEodPriceNote")
                  : t("pages.investments.stockLiveDataNote")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="dda-scroll overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {t("pages.investments.buyAvailable")}:{" "}
              <span className="font-semibold tabular-nums text-gray-300">
                {formatPoolCurrency(availableBalance)}
              </span>
            </p>
            <div className="flex gap-1 rounded-lg bg-black/30 p-1">
              {["buy", "sell"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setError("");
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                    mode === tab
                      ? "bg-sky-400/15 text-sky-300 shadow-sm"
                      : "text-gray-400 hover:text-white",
                  )}
                >
                  {t(`pages.investments.stockTab${tab === "buy" ? "Buy" : "Sell"}`)}
                </button>
              ))}
            </div>
          </div>

          {mode === "buy" ? (
            <>
              <div className="mt-4" ref={searchContainerRef}>
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">
                    {t("pages.investments.buyPickSymbolLabel")}
                  </span>
                  <div className="dda-input-field--leading-icon dda-stock-symbol-field mt-1.5">
                    <span className="dda-input-field--leading-icon__icon" aria-hidden="true">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={symbolQuery}
                      onChange={(event) => {
                        const next = event.target.value;
                        setSearchFocused(true);
                        setSymbolQuery(next);
                        if (selectedSymbol) {
                          const ticker = extractTickerFromQuery(next);
                          if (ticker !== selectedSymbol) setSelectedSymbol("");
                        }
                        setError("");
                      }}
                      onFocus={() => setSearchFocused(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitSymbolQuery();
                        }
                        if (event.key === "Escape") {
                          setSearchFocused(false);
                        }
                      }}
                      placeholder={t("pages.investments.buyPickSymbolPlaceholder")}
                      autoComplete="off"
                      spellCheck={false}
                      className="dda-input w-full"
                    />
                    {symbolQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSymbolQuery("");
                          setSelectedSymbol("");
                          setSearchFocused(true);
                          setError("");
                        }}
                        aria-label={t("pages.investments.stockClearSearch")}
                        className="dda-stock-symbol-field__clear"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}

                    {showSearchResults ? (
                      <div className="dda-stock-search-results absolute z-20 mt-1.5 max-h-60 w-full overflow-y-auto rounded-xl border border-white/10 bg-dda-bg shadow-2xl ring-1 ring-white/5">
                        {searchLoading ? (
                          <p className="flex items-center gap-2 px-3 py-3 text-sm text-gray-500">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            {t("pages.investments.stockSearchLoading")}
                          </p>
                        ) : searchError ? (
                          <p className="px-3 py-3 text-sm text-red-400">{searchError}</p>
                        ) : searchResults.length ? (
                          <ul role="listbox" aria-label={t("pages.investments.buyPickSymbolLabel")}>
                            {searchResults.map((item) => (
                              <li key={item.symbol}>
                                <button
                                  type="button"
                                  role="option"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => pickSearchResult(item)}
                                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/5"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-white">{item.symbol}</p>
                                    <p className="truncate text-xs text-gray-500">{item.name}</p>
                                  </div>
                                  {item.primaryExchange ? (
                                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-600">
                                      {item.primaryExchange}
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="px-3 py-3 text-sm text-gray-500">
                            {t("pages.investments.stockSearchNoResults")}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-600">
                    {t("pages.investments.stockSearchHint")}
                  </p>
                </label>
              </div>

              {selectedSymbol ? (
                <div className="dda-stock-quote-panel mt-4 rounded-2xl p-4 ring-1 ring-sky-400/15">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold tracking-tight text-white">{selectedSymbol}</p>
                        {quoteLoading ? (
                          <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-sky-300" />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-gray-400">
                        {details?.name ?? selectedSymbol}
                      </p>
                      {details?.primaryExchange ? (
                        <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-gray-600">
                          {details.primaryExchange}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold tabular-nums text-white">
                        {livePrice > 0 ? formatQuotePrice(livePrice) : "—"}
                      </p>
                      {quote ? (
                        <p
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 text-sm font-semibold tabular-nums",
                            changePositive ? "text-dda-green-light" : "text-red-400",
                          )}
                        >
                          {changePositive ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                          {formatQuoteChange(quote.change, quote.changePct)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {quoteError ? (
                    <p className="mt-3 text-sm text-red-400">{quoteError}</p>
                  ) : quote ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <QuoteStat label={t("pages.investments.stockOpen")} value={quote.open != null ? formatQuotePrice(quote.open) : "—"} />
                      <QuoteStat label={t("pages.investments.stockHigh")} value={quote.high != null ? formatQuotePrice(quote.high) : "—"} accent="text-dda-green-light" />
                      <QuoteStat label={t("pages.investments.stockLow")} value={quote.low != null ? formatQuotePrice(quote.low) : "—"} accent="text-red-400" />
                      <QuoteStat
                        label={t("pages.investments.stockVolume")}
                        value={quote.volume != null ? quote.volume.toLocaleString("en-US") : "—"}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">{t("pages.investments.stockSharesLabel")}</span>
                  <div className="dda-qty-input mt-1.5">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={shares}
                      onChange={(event) => {
                        setShares(event.target.value.replace(/[^\d.]/g, ""));
                        setError("");
                      }}
                      placeholder="0"
                      className="dda-input dda-qty-input__field w-full"
                    />
                    <div className="dda-qty-input__steppers">
                      <button
                        type="button"
                        onClick={() => adjustShares(1)}
                        aria-label={t("pages.investments.stockIncreaseShares")}
                        className="dda-qty-input__stepper-btn"
                      >
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustShares(-1)}
                        aria-label={t("pages.investments.stockDecreaseShares")}
                        className="dda-qty-input__stepper-btn"
                        disabled={!parsedShares}
                      >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </label>
              </div>

              <div className="dda-panel mt-4 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-400">{t("pages.investments.stockLivePrice")}</span>
                  <span className="font-bold tabular-nums text-white">
                    {livePrice > 0 ? formatQuotePrice(livePrice) : "—"}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-sm">
                  <span className="text-gray-400">{t("pages.investments.buyTotalLabel")}</span>
                  <span className="font-bold tabular-nums text-white">{formatPoolCurrency(orderTotal)}</span>
                </div>
                {orderTotal > availableBalance ? (
                  <p className="mt-2 text-xs text-red-400">{t("pages.investments.buyInsufficient")}</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {openStockPositions.length ? (
                <ul className="mt-4 space-y-2">
                  {openStockPositions.map((position) => {
                    const symbol = (position.marketSymbol ?? position.contractId).toUpperCase();
                    const snapshot = positionQuotes[symbol];
                    const entry =
                      position.entryPrice ??
                      (position.contracts > 0 ? position.principal / position.contracts : 0);
                    const market = snapshot?.price ?? position.marketPrice ?? entry;
                    const metrics = computeStockPositionMetrics(position.contracts, entry, market);
                    const selected = sellPositionId === position.id;
                    const gain = metrics.pnl >= 0;

                    return (
                      <li key={position.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSellPositionId(position.id);
                            setError("");
                          }}
                          className={cn(
                            "dda-glass-btn w-full rounded-xl px-4 py-3 text-left transition",
                            selected && "border-sky-400/30 ring-1 ring-sky-400/20",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{symbol}</p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                {position.contracts} {t("pages.investments.stockSharesUnit")} · {t("pages.investments.stockCostBasis")}{" "}
                                {formatQuotePrice(entry)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold tabular-nums text-white">
                                {formatPoolCurrency(metrics.marketValue)}
                              </p>
                              <p
                                className={cn(
                                  "mt-0.5 inline-flex items-center gap-1 text-xs font-semibold tabular-nums",
                                  gain ? "text-dda-green-light" : "text-red-400",
                                )}
                              >
                                {gain ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                {gain ? "+" : ""}
                                {formatPoolCurrency(metrics.pnl)} ({gain ? "+" : ""}
                                {metrics.pnlPct.toFixed(2)}%)
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-gray-500">{t("pages.investments.stockNoOpenPositions")}</p>
              )}

              {sellPosition ? (
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block min-w-0 flex-1">
                      <span className="text-xs font-medium text-gray-400">
                        {t("pages.investments.stockSharesToSell")}
                      </span>
                      <div className="dda-qty-input mt-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={sellShares}
                          onChange={(event) => {
                            setSellShares(event.target.value.replace(/[^\d.]/g, ""));
                            setError("");
                          }}
                          placeholder="0"
                          className="dda-input dda-qty-input__field w-full"
                        />
                        <div className="dda-qty-input__steppers">
                          <button
                            type="button"
                            onClick={() => adjustSellShares(1)}
                            aria-label={t("pages.investments.stockIncreaseShares")}
                            className="dda-qty-input__stepper-btn"
                          >
                            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustSellShares(-1)}
                            aria-label={t("pages.investments.stockDecreaseShares")}
                            className="dda-qty-input__stepper-btn"
                            disabled={!parsedSellShares}
                          >
                            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={setSellAllShares}
                      className="mt-5 shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:border-sky-400/25 hover:text-white"
                    >
                      {t("pages.investments.stockSellAll")}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {t("pages.investments.stockSellMaxShares", { count: sellPosition.contracts })}
                  </p>
                  {sellSharesExceedsHoldings ? (
                    <p className="mt-1 text-xs text-red-400">
                      {t("pages.investments.stockSellExceedsShares")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {sellPosition && sellMetrics ? (
                <div className="dda-panel mt-4 rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-400">{t("pages.investments.stockLivePrice")}</span>
                    <span className="font-bold tabular-nums text-white">{formatQuotePrice(sellPrice)}</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-sm">
                    <span className="text-gray-400">{t("pages.investments.stockProceeds")}</span>
                    <span className="font-bold tabular-nums text-white">
                      {formatPoolCurrency(sellProceeds > 0 ? sellProceeds : sellMetrics.marketValue)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-sm">
                    <span className="text-gray-400">{t("pages.investments.stockUnrealizedPnl")}</span>
                    <span
                      className={cn(
                        "font-bold tabular-nums",
                        sellMetrics.pnl >= 0 ? "text-dda-green-light" : "text-red-400",
                      )}
                    >
                      {sellMetrics.pnl >= 0 ? "+" : ""}
                      {formatPoolCurrency(sellMetrics.pnl)} ({sellMetrics.pnl >= 0 ? "+" : ""}
                      {sellMetrics.pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              ) : null}

              {positionsLoading ? (
                <p className="mt-3 text-xs text-gray-500">{t("pages.investments.stockRefreshingQuotes")}</p>
              ) : null}
            </>
          )}

          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/10"
            >
              {t("common.close")}
            </button>
            {mode === "buy" ? (
              <button
                type="button"
                onClick={handleBuy}
                disabled={!canBuy || orderTotal > availableBalance || quoteLoading}
                className="dda-btn-primary px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pages.investments.stockBuyShares")}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSell}
                disabled={!canSell}
                className="rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("pages.investments.stockSellShares")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
