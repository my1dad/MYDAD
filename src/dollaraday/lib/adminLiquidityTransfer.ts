import { DATA_BIN_BY_KEY } from "./dataBins";
import { appendDataRecord, readDataBin } from "./internalDatabase";
import {
  depositToMemberAccount,
  getAdminLiquidityAvailable,
  hydrateMemberAccounts,
  spendFromMemberAccount,
} from "./memberAccounts";
import { getActiveDadProfile } from "./dadProfileStorage";
import { logProfileActivity } from "./profileActivity";
import { syncMemberEscrowToLiquidityPool } from "./poolState";

export type AdminLiquidityTransferDirection = "to-liquidity" | "to-admin";

const TRANSFER_SOURCE = "admin-liquidity-transfer";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function pushTransferBinsNow() {
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(async ({ pushCloudBinsNow }) => {
      await pushCloudBinsNow(
        [
          { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
          { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
          { binId: DATA_BIN_BY_KEY.adminCaptures.binId, document: readDataBin("adminCaptures") },
        ],
        { force: true },
      );
    });
  });
}

/** Admin operating cash available to move into liquidity. */
export function getAdminAccountTransferAvailable(profileId: string): number {
  if (!profileId) return 0;
  const ledger = hydrateMemberAccounts(profileId);
  return Math.max(0, roundMoney(Number(ledger.checkingBalance) || 0));
}

export function transferAdminAndLiquidity(input: {
  profileId: string;
  direction: AdminLiquidityTransferDirection;
  amount: number;
  memo?: string;
}): { ok: true } | { ok: false; error: "insufficient" | "invalid" } {
  const amount = roundMoney(input.amount);
  if (!input.profileId || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid" };
  }

  const memo =
    input.memo?.trim() ||
    (input.direction === "to-liquidity"
      ? "Transfer · Admin account → Liquidity"
      : "Transfer · Liquidity → Admin account");
  const transferredAt = new Date().toISOString();

  if (input.direction === "to-liquidity") {
    const available = getAdminAccountTransferAvailable(input.profileId);
    if (amount > available + 0.001) {
      return { ok: false, error: "insufficient" };
    }
    if (!spendFromMemberAccount(input.profileId, "checking", amount, memo)) {
      return { ok: false, error: "insufficient" };
    }
  } else {
    const available = getAdminLiquidityAvailable();
    if (amount > available + 0.001) {
      return { ok: false, error: "insufficient" };
    }
    if (!depositToMemberAccount(input.profileId, "checking", amount, memo)) {
      return { ok: false, error: "invalid" };
    }
  }

  appendDataRecord("contributions", TRANSFER_SOURCE, {
    type: "admin-liquidity-transfer",
    source: TRANSFER_SOURCE,
    direction: input.direction,
    amount,
    status: "completed",
    profileId: input.profileId,
    memberId: input.profileId,
    memo,
    transferredAt,
    contributedAt: transferredAt,
  });

  const active = getActiveDadProfile();
  if (active) {
    logProfileActivity({
      profileId: active.id,
      proId: active.proId,
      type: "redemption",
      summary:
        input.direction === "to-liquidity"
          ? `Transferred $${amount.toFixed(2)} to liquidity`
          : `Transferred $${amount.toFixed(2)} from liquidity to admin account`,
      payload: {
        direction: input.direction,
        amount,
        memo,
      },
    });
  }

  syncMemberEscrowToLiquidityPool();
  pushTransferBinsNow();
  return { ok: true };
}
