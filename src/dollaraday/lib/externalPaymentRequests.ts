import { isAdminProfile } from "../../config/admin";
import {
  appendDataRecord,
  readDataBin,
  upsertDataRecord,
} from "./internalDatabase";
import { adminSetMemberDirectoryBalances, findStoredMemberByProfileId } from "./memberRegistry";
import { depositToMemberAccount, getMemberAccountLedger } from "./memberAccounts";
import { logProfileActivity } from "./profileActivity";
import { syncMemberEscrowToLiquidityPool, syncPoolInflowMetrics } from "./poolState";
import { DATA_BIN_BY_KEY } from "./dataBins";
import type { DadProfile } from "./dadProfileStorage";
import { getActiveDadProfile } from "./dadProfileStorage";

export type ExternalPaymentMethod = "zelle" | "apple-pay";
export type ExternalPaymentStatus = "pending" | "completed" | "denied";

export interface ExternalPaymentRequest {
  id: string;
  method: ExternalPaymentMethod;
  amount: number;
  profileId: string;
  memberId: string;
  memberName: string;
  handle: string;
  username?: string;
  memo: string;
  status: ExternalPaymentStatus;
  contributedAt: string;
  completedAt?: string;
  completedBy?: string;
}

const REQUEST_SOURCE = "external-payment-request";
const ADMIN_CREDIT_SOURCE = "admin-payment-request-credit";
const ADMIN_CREDIT_MEMO = "Payment request credit";

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function buildHandle(username?: string, fallback?: string): string {
  const raw = (username || fallback || "member").replace(/^@/, "").trim();
  return raw ? `@${raw}` : "@member";
}

export function listExternalPaymentRequests(
  options: { status?: ExternalPaymentStatus } = {},
): ExternalPaymentRequest[] {
  return readDataBin("contributions")
    .records.map((record) => {
      const payload = record.payload ?? {};
      const type = typeof payload.type === "string" ? payload.type : "";
      const source = record.source || (typeof payload.source === "string" ? payload.source : "");
      if (type !== "external-payment-request" && source !== REQUEST_SOURCE) return null;

      const amount = Number(payload.amount) || 0;
      const method =
        payload.method === "zelle" || payload.method === "apple-pay"
          ? payload.method
          : "zelle";
      const status =
        payload.status === "completed" || payload.status === "denied" || payload.status === "pending"
          ? payload.status
          : "pending";
      const profileId =
        typeof payload.profileId === "string"
          ? payload.profileId
          : typeof payload.memberId === "string"
            ? payload.memberId
            : "";
      if (!profileId || amount <= 0) return null;

      return {
        id: record.id,
        method,
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
            : buildHandle(
                typeof payload.username === "string" ? payload.username : undefined,
              ),
        username: typeof payload.username === "string" ? payload.username : undefined,
        memo: typeof payload.memo === "string" ? payload.memo : "",
        status,
        contributedAt:
          typeof payload.contributedAt === "string" ? payload.contributedAt : record.createdAt,
        completedAt: typeof payload.completedAt === "string" ? payload.completedAt : undefined,
        completedBy: typeof payload.completedBy === "string" ? payload.completedBy : undefined,
      } satisfies ExternalPaymentRequest;
    })
    .filter((entry): entry is ExternalPaymentRequest => Boolean(entry))
    .filter((entry) => (options.status ? entry.status === options.status : true))
    .sort((a, b) => b.contributedAt.localeCompare(a.contributedAt));
}

export function getPendingExternalPaymentRequests(): ExternalPaymentRequest[] {
  return listExternalPaymentRequests({ status: "pending" });
}

export async function requestExternalPayment(input: {
  method: ExternalPaymentMethod;
  amount: number;
  memo?: string;
  profile?: DadProfile | null;
}): Promise<{ ok: true; request: ExternalPaymentRequest } | { ok: false; error: string }> {
  const profile = input.profile ?? getActiveDadProfile();
  if (!profile || isAdminProfile(profile)) {
    return { ok: false, error: "Sign in as a member to submit a payment request." };
  }

  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than $0." };
  }

  const contributedAt = new Date().toISOString();
  const memberName = profile.fullName?.trim() || profile.displayName?.trim() || profile.username;
  const handle = buildHandle(profile.username);
  const memo =
    input.memo?.trim() ||
    `${input.method === "zelle" ? "Zelle" : "Apple Pay"} payment request · ${memberName}`;

  const record = appendDataRecord("contributions", REQUEST_SOURCE, {
    type: "external-payment-request",
    source: REQUEST_SOURCE,
    method: input.method,
    amount,
    reminderEnabled: false,
    recurringEnabled: false,
    profileId: profile.id,
    memberId: profile.id,
    memberName,
    handle,
    username: profile.username,
    contributedAt,
    status: "pending",
    memo,
  });

  logProfileActivity({
    profileId: profile.id,
    proId: profile.proId,
    type: "donation",
    summary: `Requested ${input.method === "zelle" ? "Zelle" : "Apple Pay"} payment of $${amount.toFixed(2)}`,
    payload: {
      amount,
      method: input.method,
      requestId: record.id,
      status: "pending",
    },
  });

  const request: ExternalPaymentRequest = {
    id: record.id,
    method: input.method,
    amount,
    profileId: profile.id,
    memberId: profile.id,
    memberName,
    handle,
    username: profile.username,
    memo,
    status: "pending",
    contributedAt,
  };

  try {
    const { pushCloudBinsNow } = await import("./supabase/cloudSync");
    await pushCloudBinsNow(
      [
        { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
        { binId: DATA_BIN_BY_KEY.adminCaptures.binId, document: readDataBin("adminCaptures") },
      ],
      { force: true },
    );
  } catch (err) {
    console.warn("[externalPaymentRequests] Cloud push after request failed:", err);
  }

  return { ok: true, request };
}

export async function approveExternalPaymentRequest(
  requestId: string,
): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const request = getPendingExternalPaymentRequests().find((item) => item.id === requestId);
  if (!request) return { ok: false, error: "Payment request not found or already handled." };

  const amount = roundMoney(request.amount);
  const profileId = request.profileId;
  const note = `${ADMIN_CREDIT_MEMO} · ${request.method === "zelle" ? "Zelle" : "Apple Pay"}`;

  const checkingLedger = depositToMemberAccount(profileId, "checking", amount, note);
  if (!checkingLedger) {
    return { ok: false, error: "Could not credit this member’s checking balance." };
  }

  const afterChecking = getMemberAccountLedger(profileId);
  const escrowGap = roundMoney(
    Math.max(
      0,
      (Number(afterChecking.checkingBalance) || 0) - (Number(afterChecking.escrowBalance) || 0),
    ),
  );
  if (escrowGap > 0) {
    depositToMemberAccount(profileId, "escrow", escrowGap, note);
  }

  const stored = findStoredMemberByProfileId(profileId);
  const currentEquity = Number(stored?.equity) || 0;
  const nextContributed = roundMoney((Number(stored?.contributed) || 0) + amount);
  const nextEquity = roundMoney(currentEquity + amount);
  const directory = adminSetMemberDirectoryBalances(profileId, {
    contributed: nextContributed,
    equity: Math.max(nextEquity, nextContributed),
  });
  if (!directory) {
    return { ok: false, error: "Could not update member directory balances." };
  }

  const completedAt = new Date().toISOString();
  const admin = getActiveDadProfile();

  upsertDataRecord("contributions", requestId, REQUEST_SOURCE, {
    type: "external-payment-request",
    source: REQUEST_SOURCE,
    method: request.method,
    amount,
    reminderEnabled: false,
    recurringEnabled: false,
    profileId,
    memberId: profileId,
    memberName: request.memberName,
    handle: request.handle,
    username: request.username,
    contributedAt: request.contributedAt,
    status: "completed",
    memo: request.memo,
    completedAt,
    completedBy: admin?.id,
  });

  appendDataRecord("contributions", "wallet-deposit", {
    type: "wallet-deposit",
    source: ADMIN_CREDIT_SOURCE,
    amount,
    reminderEnabled: false,
    recurringEnabled: false,
    profileId,
    memberId: profileId,
    memberName: request.memberName,
    handle: request.handle,
    contributedAt: completedAt,
    status: "completed",
    memo: note,
    linkedRequestId: requestId,
  });

  logProfileActivity({
    profileId,
    type: "donation",
    summary: `Admin credited $${amount.toFixed(2)} for ${request.method === "zelle" ? "Zelle" : "Apple Pay"} request`,
    payload: {
      amount,
      method: request.method,
      requestId,
      source: ADMIN_CREDIT_SOURCE,
    },
  });

  syncPoolInflowMetrics();
  syncMemberEscrowToLiquidityPool();

  try {
    const { pushCloudBinsNow } = await import("./supabase/cloudSync");
    await pushCloudBinsNow(
      [
        { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
        { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
        { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
        { binId: DATA_BIN_BY_KEY.adminCaptures.binId, document: readDataBin("adminCaptures") },
      ],
      { force: true },
    );
  } catch (err) {
    console.warn("[externalPaymentRequests] Cloud push after approve failed:", err);
  }

  return {
    ok: true,
    balance: Number(getMemberAccountLedger(profileId).checkingBalance) || 0,
  };
}

export async function denyExternalPaymentRequest(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const request = getPendingExternalPaymentRequests().find((item) => item.id === requestId);
  if (!request) return { ok: false, error: "Payment request not found or already handled." };

  const completedAt = new Date().toISOString();
  const admin = getActiveDadProfile();

  upsertDataRecord("contributions", requestId, REQUEST_SOURCE, {
    type: "external-payment-request",
    source: REQUEST_SOURCE,
    method: request.method,
    amount: request.amount,
    reminderEnabled: false,
    recurringEnabled: false,
    profileId: request.profileId,
    memberId: request.memberId,
    memberName: request.memberName,
    handle: request.handle,
    username: request.username,
    contributedAt: request.contributedAt,
    status: "denied",
    memo: request.memo,
    completedAt,
    completedBy: admin?.id,
  });

  logProfileActivity({
    profileId: request.profileId,
    type: "donation",
    summary: `Admin denied ${request.method === "zelle" ? "Zelle" : "Apple Pay"} payment request of $${request.amount.toFixed(2)}`,
    payload: {
      amount: request.amount,
      method: request.method,
      requestId,
      status: "denied",
    },
  });

  try {
    const { pushCloudBinsNow } = await import("./supabase/cloudSync");
    await pushCloudBinsNow(
      [
        { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
        { binId: DATA_BIN_BY_KEY.adminCaptures.binId, document: readDataBin("adminCaptures") },
      ],
      { force: true },
    );
  } catch (err) {
    console.warn("[externalPaymentRequests] Cloud push after deny failed:", err);
  }

  return { ok: true };
}
