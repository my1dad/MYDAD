import { isAdminProfile } from "../../config/admin";
import { DATA_BIN_BY_KEY } from "./dataBins";
import {
  appendDataRecord,
  readDataBin,
  upsertDataRecord,
} from "./internalDatabase";
import { findDadProfileById, getActiveDadProfile } from "./dadProfileStorage";
import { hydrateMemberAccounts, resolveMemberProfileId } from "./memberAccounts";
import { logProfileActivity } from "./profileActivity";
import { saveAdminRedemption } from "./redemptions";

export type MemberRedemptionRequestStatus = "pending" | "completed" | "denied";

export interface MemberRedemptionRequest {
  id: string;
  amount: number;
  profileId: string;
  memberId: string;
  memberName: string;
  handle: string;
  username?: string;
  memo: string;
  status: MemberRedemptionRequestStatus;
  availableAtRequest: number;
  contributedAt: string;
  completedAt?: string;
  completedBy?: string;
}

const REQUEST_SOURCE = "member-redemption-request";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildHandle(username?: string): string {
  const raw = (username || "").replace(/^@/, "").trim();
  return raw ? `@${raw}` : "@member";
}

/** Available balance a member may request to redeem (personal cash). */
export function getMemberRedeemableBalance(profileId: string): number {
  if (!profileId) return 0;
  const ledger = hydrateMemberAccounts(profileId);
  return Math.max(0, roundMoney(Number(ledger.checkingBalance) || 0));
}

export function listMemberRedemptionRequests(
  options: { status?: MemberRedemptionRequestStatus } = {},
): MemberRedemptionRequest[] {
  const rows: MemberRedemptionRequest[] = [];

  for (const record of readDataBin("contributions").records) {
    const payload = record.payload ?? {};
    const type = typeof payload.type === "string" ? payload.type : "";
    const source = record.source || (typeof payload.source === "string" ? payload.source : "");
    if (type !== "member-redemption-request" && source !== REQUEST_SOURCE) continue;

    const amount = Number(payload.amount) || 0;
    const status: MemberRedemptionRequestStatus =
      payload.status === "completed" || payload.status === "denied" || payload.status === "pending"
        ? payload.status
        : "pending";
    const profileId =
      typeof payload.profileId === "string"
        ? payload.profileId
        : typeof payload.memberId === "string"
          ? payload.memberId
          : "";
    if (!profileId || amount <= 0) continue;

    rows.push({
      id: record.id,
      amount,
      profileId,
      memberId: typeof payload.memberId === "string" ? payload.memberId : profileId,
      memberName:
        typeof payload.memberName === "string" && payload.memberName.trim()
          ? payload.memberName.trim()
          : "Member",
      handle:
        typeof payload.handle === "string" && payload.handle.trim()
          ? payload.handle.trim()
          : buildHandle(typeof payload.username === "string" ? payload.username : undefined),
      username: typeof payload.username === "string" ? payload.username : undefined,
      memo: typeof payload.memo === "string" ? payload.memo : "",
      status,
      availableAtRequest: Number(payload.availableAtRequest) || amount,
      contributedAt:
        typeof payload.contributedAt === "string" ? payload.contributedAt : record.createdAt,
      completedAt: typeof payload.completedAt === "string" ? payload.completedAt : undefined,
      completedBy: typeof payload.completedBy === "string" ? payload.completedBy : undefined,
    });
  }

  return rows
    .filter((entry) => (options.status ? entry.status === options.status : true))
    .sort((a, b) => b.contributedAt.localeCompare(a.contributedAt));
}

export function getPendingMemberRedemptionRequests(): MemberRedemptionRequest[] {
  return listMemberRedemptionRequests({ status: "pending" });
}

function pushRequestBinsNow() {
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

export function requestMemberRedemption(input: {
  amount: number;
  memo?: string;
  availableBalance?: number;
}): { ok: true; requestId: string } | { ok: false; error: "invalid" | "insufficient" | "auth" } {
  const profile = getActiveDadProfile();
  if (!profile || isAdminProfile(profile)) {
    return { ok: false, error: "auth" };
  }

  const available = roundMoney(
    Number.isFinite(input.availableBalance)
      ? Math.max(0, Number(input.availableBalance))
      : getMemberRedeemableBalance(profile.id),
  );
  let amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "invalid" };
  }
  if (amount > available + 0.001) {
    amount = available;
  }
  if (amount <= 0) {
    return { ok: false, error: "insufficient" };
  }

  const memberName =
    profile.fullName?.trim() || profile.displayName?.trim() || profile.username || "Member";
  const handle = buildHandle(profile.username);
  const contributedAt = new Date().toISOString();
  const memo = input.memo?.trim() || `Redemption request · ${memberName}`;

  const record = appendDataRecord("contributions", REQUEST_SOURCE, {
    type: "member-redemption-request",
    source: REQUEST_SOURCE,
    amount,
    availableAtRequest: available,
    status: "pending",
    profileId: profile.id,
    memberId: profile.id,
    memberName,
    handle,
    username: profile.username,
    memo,
    contributedAt,
    direction: "member-to-admin-request",
  });

  logProfileActivity({
    profileId: profile.id,
    proId: profile.proId,
    type: "redemption",
    summary: `Requested $${amount.toFixed(2)} redemption`,
    payload: { amount, requestId: record.id, status: "pending" },
  });

  pushRequestBinsNow();
  return { ok: true, requestId: record.id };
}

export function fulfillMemberRedemptionRequest(
  requestId: string,
): { ok: true } | { ok: false; error: string } {
  const request = getPendingMemberRedemptionRequests().find((item) => item.id === requestId);
  if (!request) return { ok: false, error: "Request not found or already handled." };

  const admin = getActiveDadProfile();
  if (!admin || !isAdminProfile(admin)) {
    return { ok: false, error: "Only master admin can fulfill redemption requests." };
  }

  const fromProfileId = resolveMemberProfileId() || admin.id;
  const result = saveAdminRedemption({
    fromProfileId,
    toProfileId: request.profileId,
    amount: request.amount,
    memo: request.memo || `Fulfilled redemption request · ${request.memberName}`,
    memberName: request.memberName,
    handle: request.handle,
  });
  if (!result.ok) {
    return {
      ok: false,
      error:
        result.error === "insufficient"
          ? "Insufficient community liquidity to fulfill this request."
          : "Could not fulfill this redemption request.",
    };
  }

  const completedAt = new Date().toISOString();
  upsertDataRecord("contributions", requestId, REQUEST_SOURCE, {
    type: "member-redemption-request",
    source: REQUEST_SOURCE,
    amount: request.amount,
    availableAtRequest: request.availableAtRequest,
    status: "completed",
    profileId: request.profileId,
    memberId: request.profileId,
    memberName: request.memberName,
    handle: request.handle,
    username: request.username,
    memo: request.memo,
    contributedAt: request.contributedAt,
    completedAt,
    completedBy: admin.id,
    fulfilledRedemptionId: result.recordId,
  });

  logProfileActivity({
    profileId: request.profileId,
    proId: findDadProfileById(request.profileId)?.proId,
    type: "redemption",
    summary: `Redemption request fulfilled · $${request.amount.toFixed(2)}`,
    payload: { amount: request.amount, requestId, status: "completed" },
  });

  pushRequestBinsNow();
  return { ok: true };
}

export function denyMemberRedemptionRequest(
  requestId: string,
): { ok: true } | { ok: false; error: string } {
  const request = getPendingMemberRedemptionRequests().find((item) => item.id === requestId);
  if (!request) return { ok: false, error: "Request not found or already handled." };

  const admin = getActiveDadProfile();
  const completedAt = new Date().toISOString();
  upsertDataRecord("contributions", requestId, REQUEST_SOURCE, {
    type: "member-redemption-request",
    source: REQUEST_SOURCE,
    amount: request.amount,
    availableAtRequest: request.availableAtRequest,
    status: "denied",
    profileId: request.profileId,
    memberId: request.profileId,
    memberName: request.memberName,
    handle: request.handle,
    username: request.username,
    memo: request.memo,
    contributedAt: request.contributedAt,
    completedAt,
    completedBy: admin?.id,
  });

  logProfileActivity({
    profileId: request.profileId,
    proId: findDadProfileById(request.profileId)?.proId,
    type: "redemption",
    summary: `Redemption request declined · $${request.amount.toFixed(2)}`,
    payload: { amount: request.amount, requestId, status: "denied" },
  });

  pushRequestBinsNow();
  return { ok: true };
}
