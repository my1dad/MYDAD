import { isValidTickerSymbol, roundMoney, roundShares } from "./massiveMarket";
import {
  appendAllocationPosition,
  closeAllocationPosition,
  getActiveStockPositions,
  patchAllocationPosition,
  syncStockMarketPricesInStore,
  type AllocationPosition,
} from "./allocationPositions";
import { increaseDeployedCapital, decreaseDeployedCapital } from "./poolState";
import { depositToMemberAccount, resolveMemberProfileId, spendFromMemberAccount } from "./memberAccounts";
import { appendAllocationYieldLogEntry } from "./allocationYieldLog";
import { processAllocationYieldAccrual } from "./allocationYieldAccrual";
import { getPositionRoi } from "./allocationRoi";
import { easternNow, formatEasternIsoDate } from "./dateTime";

export type StockTradeResult = "ok" | "invalid" | "insufficient" | "not_found";

export function isStockPosition(position: AllocationPosition): boolean {
  return position.sleeveKey === "stocks" && Boolean(position.marketSymbol ?? position.contractId);
}

export function buyStockAllocation(input: {
  symbol: string;
  shares: number;
  price: number;
  label?: string;
}): StockTradeResult {
  const symbol = input.symbol.trim().toUpperCase();
  if (!isValidTickerSymbol(symbol) || !Number.isFinite(input.shares) || input.shares <= 0) return "invalid";
  if (!Number.isFinite(input.price) || input.price <= 0) return "invalid";

  const shares = roundShares(input.shares);
  const price = roundMoney(input.price);
  const total = roundMoney(shares * price);
  if (total <= 0) return "invalid";

  const profileId = resolveMemberProfileId();
  const label = input.label?.trim() || symbol;
  const memo = `${symbol} · ${shares} sh @ $${price.toFixed(2)} (stocks)`;
  const ledger = spendFromMemberAccount(profileId, "escrow", total, memo);
  if (!ledger) return "insufficient";

  increaseDeployedCapital(total);

  const purchasedDate = formatEasternIsoDate();
  const position = appendAllocationPosition({
    id: `stock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId,
    sleeveKey: "stocks",
    contractId: symbol,
    contractLabel: label,
    principal: total,
    contracts: shares,
    annualYieldPct: 0,
    purchasedDate,
    maturityDate: "2099-12-31",
    lastAccruedDate: purchasedDate,
    matured: false,
    createdAt: easternNow().toISOString(),
    entryPrice: price,
    marketPrice: price,
    marketSymbol: symbol,
  });

  appendAllocationYieldLogEntry({
    positionId: position.id,
    profileId,
    sleeveKey: "stocks",
    contractLabel: label,
    dayYmd: purchasedDate,
    returnPct: 0,
    amount: 0,
    principalBefore: total,
    principalAfter: total,
  });

  processAllocationYieldAccrual();

  return "ok";
}

export function sellStockAllocation(input: {
  positionId: string;
  exitPrice: number;
  shares?: number;
}): StockTradeResult {
  if (!Number.isFinite(input.exitPrice) || input.exitPrice <= 0) return "invalid";

  const profileId = resolveMemberProfileId();
  const position = getActiveStockPositions(profileId).find((item) => item.id === input.positionId);
  if (!position) return "not_found";

  const heldShares = position.contracts;
  const sharesToSell =
    input.shares != null ? roundShares(input.shares) : roundShares(heldShares);
  if (
    !Number.isFinite(sharesToSell) ||
    sharesToSell <= 0 ||
    sharesToSell > heldShares + 0.00001
  ) {
    return "invalid";
  }

  const exitPrice = roundMoney(input.exitPrice);
  const proceeds = roundMoney(sharesToSell * exitPrice);
  const costBasis = roundMoney((position.principal / heldShares) * sharesToSell);
  const pnl = roundMoney(proceeds - costBasis);
  const symbol = position.marketSymbol ?? position.contractId;
  const sellingAll = sharesToSell >= heldShares - 0.00001;

  const credited = depositToMemberAccount(
    profileId,
    "escrow",
    proceeds,
    `${symbol} sell · ${sharesToSell} sh @ $${exitPrice.toFixed(2)} · P/L ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
  );
  if (!credited) return "invalid";

  decreaseDeployedCapital(costBasis);

  const today = formatEasternIsoDate();

  if (sellingAll) {
    const roi = getPositionRoi(position);
    appendAllocationYieldLogEntry({
      positionId: position.id,
      profileId,
      sleeveKey: "stocks",
      contractLabel: position.contractLabel,
      dayYmd: today,
      returnPct: roi.pct,
      amount: roi.amount,
      principalBefore: position.principal,
      principalAfter: 0,
    });
    closeAllocationPosition(position.id);
  } else {
    const remainingShares = roundShares(heldShares - sharesToSell);
    const remainingPrincipal = roundMoney(position.principal - costBasis);
    const updated = patchAllocationPosition(position.id, {
      contracts: remainingShares,
      principal: remainingPrincipal,
      marketPrice: exitPrice,
    });
    if (updated) {
      const roi = getPositionRoi(updated);
      appendAllocationYieldLogEntry({
        positionId: updated.id,
        profileId,
        sleeveKey: "stocks",
        contractLabel: updated.contractLabel,
        dayYmd: today,
        returnPct: roi.pct,
        amount: roi.amount,
        principalBefore: updated.principal,
        principalAfter: roundMoney(remainingShares * exitPrice),
      });
    }
  }

  processAllocationYieldAccrual();

  return "ok";
}

export function syncStockMarketPrices(quotes: Record<string, { price: number }>): number {
  return syncStockMarketPricesInStore(quotes);
}
