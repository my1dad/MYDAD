import { increaseDeployedCapital } from "./poolState";
import {
  depositToMemberAccount,
  resolvePlatformEscrowProfileId,
  spendFromMemberAccount,
} from "./memberAccounts";
import { findAllocationContractTerm } from "./allocationInstruments";
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

  const term = findAllocationContractTerm(contractId);
  if (!term) return "invalid";
  // Reject cross-sleeve buys (e.g. Bonds modal must only purchase bond contracts).
  if (term.sleeveKey !== sleeveKey) return "invalid";

  const memoLabel = `${contractLabel} · ${contracts} ctr @ $${price.toFixed(2)} (${term.sleeveKey})`;
  const escrowProfileId = resolvePlatformEscrowProfileId();

  // Debit Chase Escrow first, then register the position so Total Deployed can sum it.
  const ledger = spendFromMemberAccount(escrowProfileId, "escrow", total, memoLabel);
  if (!ledger) return "insufficient";

  const position = registerAllocationPosition({
    profileId: escrowProfileId,
    sleeveKey: term.sleeveKey,
    contractId,
    contractLabel,
    principal: total,
    contracts,
  });

  if (!position) {
    depositToMemberAccount(
      escrowProfileId,
      "escrow",
      total,
      "Allocation purchase reversal",
    );
    return "invalid";
  }

  increaseDeployedCapital(total);
  processAllocationYieldAccrual();
  return "ok";
}

/** @deprecated Prefer purchasePoolAllocationOrder — kept for callers that only need a cash debit. */
export function purchasePoolAllocation(
  amount: number,
  _sleeveKey: AllocationSleeveKey,
  memoLabel: string,
): AllocationPurchaseResult {
  if (!Number.isFinite(amount) || amount <= 0) return "invalid";

  const escrowProfileId = resolvePlatformEscrowProfileId();
  const ledger = spendFromMemberAccount(escrowProfileId, "escrow", amount, memoLabel);
  if (!ledger) return "insufficient";

  increaseDeployedCapital(amount);
  return "ok";
}
