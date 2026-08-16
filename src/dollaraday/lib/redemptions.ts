import { DATA_BIN_BY_KEY } from "./dataBins";
import { appendDataRecord, readDataBin } from "./internalDatabase";
import {
  getAdminLiquidityAvailable,
  redeemToMemberProfile,
} from "./memberAccounts";
import { getCompletedRedemptionOutflow } from "./memberEscrowTotals";
import { findDadProfileById, getActiveDadProfile } from "./dadProfileStorage";
import {
  adminSetMemberDirectoryBalances,
  findStoredMemberByProfileId,
} from "./memberRegistry";
import { logProfileActivity } from "./profileActivity";
import { syncMemberEscrowToLiquidityPool } from "./poolState";

export interface RedemptionRecord {
  id: string;
  amount: number;
  fromProfileId: string;
  toProfileId: string;
  profileId: string;
  memberName: string;
  handle?: string;
  memo?: string;
  redeemedAt: string;
  status: "completed";
}

const REDEMPTION_SOURCE = "admin-redemption";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildHandle(username?: string): string {
  const raw = (username || "").replace(/^@/, "").trim();
  return raw ? `@${raw}` : "";
}

export { getCompletedRedemptionOutflow };

export function listRedemptionRecords(): RedemptionRecord[] {
  const rows: RedemptionRecord[] = [];
  for (const record of readDataBin("contributions").records) {
    const payload = record.payload ?? {};
    if (String(payload.type ?? "") !== "redemption") continue;
    if (String(payload.status ?? "completed") !== "completed") continue;
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const toProfileId =
      typeof payload.toProfileId === "string"
        ? payload.toProfileId
        : typeof payload.profileId === "string"
          ? payload.profileId
          : typeof payload.memberId === "string"
            ? payload.memberId
            : "";
    if (!toProfileId) continue;
    rows.push({
      id: record.id,
      amount,
      fromProfileId:
        typeof payload.fromProfileId === "string" ? payload.fromProfileId : "",
      toProfileId,
      profileId: toProfileId,
      memberName:
        typeof payload.memberName === "string" && payload.memberName.trim()
          ? payload.memberName.trim()
          : "Member",
      handle: typeof payload.handle === "string" ? payload.handle : undefined,
      memo: typeof payload.memo === "string" ? payload.memo : undefined,
      redeemedAt:
        typeof payload.redeemedAt === "string"
          ? payload.redeemedAt
          : typeof payload.contributedAt === "string"
            ? payload.contributedAt
            : record.createdAt,
      status: "completed",
    });
  }
  return rows.sort((a, b) => b.redeemedAt.localeCompare(a.redeemedAt));
}

export function getPlatformRedemptionTotals(): {
  sent: number;
  received: number;
  count: number;
} {
  const rows = listRedemptionRecords();
  const sent = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
  return { sent, received: sent, count: rows.length };
}

export function getMemberRedemptionsReceived(profileId: string): {
  total: number;
  count: number;
  recent: RedemptionRecord[];
} {
  if (!profileId) return { total: 0, count: 0, recent: [] };
  const recent = listRedemptionRecords().filter((row) => row.toProfileId === profileId);
  const total = roundMoney(recent.reduce((sum, row) => sum + row.amount, 0));
  return { total, count: recent.length, recent: recent.slice(0, 8) };
}

function pushRedemptionBinsNow() {
  queueMicrotask(() => {
    void import("./supabase/cloudSync").then(async ({ pushCloudBinsNow }) => {
      await pushCloudBinsNow(
        [
          { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
          { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
          { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
          { binId: DATA_BIN_BY_KEY.adminCaptures.binId, document: readDataBin("adminCaptures") },
        ],
        { force: true },
      );
    });
  });
}

/**
 * Admin payout from platform liquidity to a member wallet.
 * Deducts community liquidity and credits the member's checking (personal cash).
 */
export function saveAdminRedemption(input: {
  fromProfileId: string;
  toProfileId: string;
  amount: number;
  memo?: string;
  memberName?: string;
  handle?: string;
}): { ok: true; recordId: string } | { ok: false; error: "insufficient" | "invalid" } {
  const amount = roundMoney(input.amount);
  if (!input.fromProfileId || !input.toProfileId || input.fromProfileId === input.toProfileId) {
    return { ok: false, error: "invalid" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid" };
  }

  const liquidityAvailable = getAdminLiquidityAvailable();
  if (amount > liquidityAvailable + 0.001) {
    return { ok: false, error: "insufficient" };
  }

  const recipient = findDadProfileById(input.toProfileId);
  const memberName =
    input.memberName?.trim() ||
    recipient?.fullName?.trim() ||
    recipient?.displayName?.trim() ||
    recipient?.username ||
    "Member";
  const handle =
    input.handle?.trim() ||
    buildHandle(recipient?.username) ||
    undefined;
  const memo = input.memo?.trim() || `Redemption · ${memberName}`;
  const redeemedAt = new Date().toISOString();

  const ok = redeemToMemberProfile(input.fromProfileId, input.toProfileId, amount, memo, {
    allowLiquidityPool: true,
    liquidityAvailable,
  });
  if (!ok) {
    return { ok: false, error: "insufficient" };
  }

  const record = appendDataRecord("contributions", REDEMPTION_SOURCE, {
    type: "redemption",
    source: REDEMPTION_SOURCE,
    amount,
    status: "completed",
    fromProfileId: input.fromProfileId,
    toProfileId: input.toProfileId,
    profileId: input.toProfileId,
    memberId: input.toProfileId,
    memberName,
    handle,
    memo,
    redeemedAt,
    contributedAt: redeemedAt,
    direction: "liquidity-to-member",
  });

  // Investments leave the platform — reduce directory equity/contributed.
  const stored = findStoredMemberByProfileId(input.toProfileId);
  if (stored) {
    adminSetMemberDirectoryBalances(input.toProfileId, {
      contributed: Math.max(0, roundMoney((Number(stored.contributed) || 0) - amount)),
      equity: Math.max(0, roundMoney((Number(stored.equity) || 0) - amount)),
    });
  }

  const active = getActiveDadProfile();
  if (active) {
    logProfileActivity({
      profileId: active.id,
      proId: active.proId,
      type: "redemption",
      summary: `Sent $${amount.toFixed(2)} to ${memberName} from liquidity`,
      payload: {
        recipientProfileId: input.toProfileId,
        amount,
        memo,
        recordId: record.id,
      },
    });
  }

  logProfileActivity({
    profileId: input.toProfileId,
    proId: recipient?.proId,
    type: "redemption",
    summary: `Received $${amount.toFixed(2)} redemption`,
    payload: {
      fromProfileId: input.fromProfileId,
      amount,
      memo,
      recordId: record.id,
    },
  });

  syncMemberEscrowToLiquidityPool();
  pushRedemptionBinsNow();

  return { ok: true, recordId: record.id };
}
