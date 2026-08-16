import { DATA_BIN_BY_KEY } from "./dataBins";
import { appendDataRecord, readDataBin } from "./internalDatabase";
import { getActiveDadProfile } from "./dadProfileStorage";
import {
  depositToMemberAccount,
  spendFromMemberAccount,
} from "./memberAccounts";
import {
  adminSetMemberDirectoryBalances,
  findStoredMemberByProfileId,
} from "./memberRegistry";
import { logProfileActivity } from "./profileActivity";
import { syncMemberEscrowToLiquidityPool, syncPoolInflowMetrics } from "./poolState";
import { getMemberRedemptionsReceived } from "./redemptions";

const REINVEST_SOURCE = "cash-reinvest";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Completed cash → equity reinvest amounts for a member. */
export function getMemberCashReinvestOutflow(profileId: string): number {
  if (!profileId) return 0;
  return roundMoney(
    readDataBin("contributions").records.reduce((sum, record) => {
      const payload = record.payload ?? {};
      const owner =
        typeof payload.profileId === "string"
          ? payload.profileId
          : typeof payload.memberId === "string"
            ? payload.memberId
            : "";
      if (owner !== profileId) return sum;
      const source = record.source || (typeof payload.source === "string" ? payload.source : "");
      const funding = typeof payload.funding === "string" ? payload.funding : "";
      if (source !== REINVEST_SOURCE && funding !== "cash-balance") return sum;
      if (String(payload.status ?? "completed") !== "completed") return sum;
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      return sum + amount;
    }, 0),
  );
}

/**
 * Cash on hand from master-admin redemptions only.
 * Starts at $0; rises when liquidity redemptions are received; falls when reinvested.
 */
export function getMemberCashBalance(profileId?: string | null): number {
  if (!profileId) return 0;
  const received = getMemberRedemptionsReceived(profileId).total;
  const reinvested = getMemberCashReinvestOutflow(profileId);
  return Math.max(0, roundMoney(received - reinvested));
}

function pushReinvestBinsNow() {
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(async ({ pushCloudBinsNow }) => {
      await pushCloudBinsNow(
        [
          { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
          { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
          { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
        ],
        { force: true },
      );
    });
  });
}

/**
 * Spend personal cash (checking) and reinvest into community equity / pool escrow.
 * Amount is capped to redemption cash on hand (not total checking).
 */
export function reinvestFromCashBalance(input: {
  amount: number;
  method?: "zelle" | "apple-pay" | "cash";
  memo?: string;
}):
  | { ok: true; balance: number }
  | { ok: false; error: "auth" | "invalid" | "insufficient" | "failed" } {
  const profile = getActiveDadProfile();
  if (!profile?.id) return { ok: false, error: "auth" };

  let amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid" };
  }

  const available = getMemberCashBalance(profile.id);
  if (amount > available + 0.001) {
    amount = available;
  }
  if (amount <= 0) {
    return { ok: false, error: "insufficient" };
  }

  const methodLabel =
    input.method === "apple-pay"
      ? "Apple Pay"
      : input.method === "zelle"
        ? "Zelle"
        : "Cash";
  const note =
    input.memo?.trim() || `Cash reinvest · ${methodLabel} · $${amount.toFixed(2)}`;

  const spent = spendFromMemberAccount(profile.id, "checking", amount, note);
  if (!spent) {
    return { ok: false, error: "insufficient" };
  }

  const escrowed = depositToMemberAccount(profile.id, "escrow", amount, note);
  if (!escrowed) {
    depositToMemberAccount(profile.id, "checking", amount, "Cash reinvest reversal");
    return { ok: false, error: "failed" };
  }

  const memberName =
    profile.fullName?.trim() || profile.displayName?.trim() || profile.username || "Member";
  const handle = profile.username ? `@${profile.username.replace(/^@/, "")}` : "@member";
  const contributedAt = new Date().toISOString();

  const stored = findStoredMemberByProfileId(profile.id);
  const nextContributed = roundMoney((Number(stored?.contributed) || 0) + amount);
  const nextEquity = roundMoney((Number(stored?.equity) || 0) + amount);
  adminSetMemberDirectoryBalances(profile.id, {
    contributed: nextContributed,
    equity: Math.max(nextEquity, nextContributed),
  });

  appendDataRecord("contributions", REINVEST_SOURCE, {
    type: "one-time",
    source: REINVEST_SOURCE,
    amount,
    reminderEnabled: false,
    recurringEnabled: false,
    profileId: profile.id,
    memberId: profile.id,
    memberName,
    handle,
    username: profile.username,
    contributedAt,
    status: "completed",
    memo: note,
    funding: "cash-balance",
    method: input.method ?? "cash",
  });

  logProfileActivity({
    profileId: profile.id,
    proId: profile.proId,
    type: "donation",
    summary: `Reinvested $${amount.toFixed(2)} from cash`,
    payload: { amount, source: REINVEST_SOURCE, method: input.method ?? "cash" },
  });

  syncPoolInflowMetrics();
  syncMemberEscrowToLiquidityPool();
  pushReinvestBinsNow();

  return { ok: true, balance: getMemberCashBalance(profile.id) };
}
