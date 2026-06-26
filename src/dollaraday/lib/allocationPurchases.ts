import { increaseDeployedCapital } from "./poolState";
import { resolveMemberProfileId, spendFromMemberAccount } from "./memberAccounts";
import { registerAllocationPosition } from "./allocationPositions";
import { processAllocationYieldAccrual } from "./allocationYieldAccrual";

export type AllocationSleeveKey = "treasury" | "bonds" | "stocks";

export type AllocationPurchaseResult = "ok" | "invalid" | "insufficient";

export interface AllocationOrderInput {
  sleeveKey: AllocationSleeveKey;
  contractId: string;
  contractLabel: string;
  contracts: number;
  price: number;
}

export function purchasePoolAllocationOrder(order: AllocationOrderInput): AllocationPurchaseResult {
  const { sleeveKey, contractId, contractLabel, contracts, price } = order;
  const total = contracts * price;

  if (!contractId.trim() || !contractLabel.trim() || !Number.isFinite(contracts) || contracts <= 0) {
    return "invalid";
  }
  if (!Number.isFinite(price) || price <= 0) return "invalid";
  if (!Number.isFinite(total) || total <= 0) return "invalid";

  const memoLabel = `${contractLabel} · ${contracts} ctr @ $${price.toFixed(2)} (${sleeveKey})`;
  const result = purchasePoolAllocation(total, sleeveKey, memoLabel);
  if (result !== "ok") return result;

  const profileId = resolveMemberProfileId();
  registerAllocationPosition({
    profileId,
    sleeveKey,
    contractId,
    contractLabel,
    principal: total,
    contracts,
  });

  processAllocationYieldAccrual();

  return "ok";
}

export function purchasePoolAllocation(
  amount: number,
  _sleeveKey: AllocationSleeveKey,
  memoLabel: string,
): AllocationPurchaseResult {
  if (!Number.isFinite(amount) || amount <= 0) return "invalid";

  const profileId = resolveMemberProfileId();
  const ledger = spendFromMemberAccount(profileId, "escrow", amount, memoLabel);
  if (!ledger) return "insufficient";

  increaseDeployedCapital(amount);
  return "ok";
}
