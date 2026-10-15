import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { formatEasternDateTime } from "../../lib/dateTime";
import { DATA_BIN_BY_KEY } from "../../lib/dataBins";
import {
  appendDataRecord,
  getDatabaseRevision,
  readDataBin,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import {
  depositToMemberAccount,
  getMemberAccountLedger,
} from "../../lib/memberAccounts";
import {
  adminSetMemberDirectoryBalances,
  applyMemberStatsFromContributions,
} from "../../lib/memberRegistry";
import { computeMemberStatsFromContributions } from "../../lib/memberContributionStats";
import { findDadProfileById, getDadProfiles } from "../../lib/dadProfileStorage";
import {
  getMemberYieldSchedule,
  isYieldInterval,
  saveMemberYieldSchedule,
} from "../../lib/memberYield";
import { logProfileActivity } from "../../lib/profileActivity";
import { syncMemberEscrowToLiquidityPool, syncPoolInflowMetrics } from "../../lib/poolState";

const ADMIN_POPUP_DEPOSIT_SOURCE = "admin-member-deposit";
const ADMIN_POPUP_DEPOSIT_MEMO = "Admin deposit";

function parseMoneyInput(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").replace(/[^0-9.]/g, "");
  if (!cleaned) return NaN;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : NaN;
}

function formatMoneyAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sanitizeMoneyTyping(value) {
  let next = String(value ?? "").replace(/[^0-9.]/g, "");
  const firstDot = next.indexOf(".");
  if (firstDot !== -1) {
    next = `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, "")}`;
  }
  return next;
}

function resolveMemberLabel(profileId, member) {
  if (member?.name) return member.name;
  const profile = getDadProfiles().find((item) => item.id === profileId);
  return profile?.displayName || profile?.fullName || member?.handle || "Member";
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatYieldMoney(value) {
  const amount = roundMoney(value);
  const body = Math.abs(amount).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount < 0) return `−${body}`;
  return `+${body}`;
}

function parseYieldPercent(value) {
  const cleaned = String(value ?? "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const percent = Number(cleaned);
  if (!Number.isFinite(percent) || percent < 0) return null;
  return percent;
}

/** Current investment balance — same equity figure as Members list / equity card. */
function readCurrentBalance(profileId) {
  if (!profileId) return 0;
  return roundMoney(computeMemberStatsFromContributions(profileId).equity);
}

function isAdminPopupDeposit(record, profileId) {
  const payload = record.payload ?? {};
  const ownerId = String(payload.profileId ?? payload.memberId ?? "");
  if (ownerId !== profileId) return false;

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (String(payload.status ?? "completed") !== "completed") return false;

  return (
    String(payload.source ?? "") === ADMIN_POPUP_DEPOSIT_SOURCE ||
    String(payload.memo ?? "") === ADMIN_POPUP_DEPOSIT_MEMO ||
    (record.source === "wallet-deposit" && String(payload.memo ?? "") === ADMIN_POPUP_DEPOSIT_MEMO)
  );
}

function readAdminPopupDeposits(profileId) {
  if (!profileId) return [];

  return readDataBin("contributions")
    .records.filter((record) => isAdminPopupDeposit(record, profileId))
    .map((record) => {
      const payload = record.payload ?? {};
      const contributedAt = String(
        payload.contributedAt ?? record.createdAt ?? record.updatedAt ?? "",
      );
      return {
        id: record.id,
        amount: roundMoney(payload.amount),
        contributedAt,
        memo: String(payload.memo ?? ADMIN_POPUP_DEPOSIT_MEMO),
      };
    })
    .sort((a, b) => b.contributedAt.localeCompare(a.contributedAt));
}

export default function AdminMemberBalanceModal({ member, open, onClose }) {
  const { t, locale } = useLocale();
  const profileId = member?.profileId ?? member?.id ?? "";
  const [depositInput, setDepositInput] = useState("");
  const [currentBalance, setCurrentBalance] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastDeposit, setLastDeposit] = useState(0);
  const [yieldDraft, setYieldDraft] = useState(null);
  const [yieldError, setYieldError] = useState("");
  const [yieldSaved, setYieldSaved] = useState(false);
  const [yieldSaving, setYieldSaving] = useState(false);

  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  const depositLog = useMemo(() => {
    void dbRevision;
    if (!open || !profileId) return [];
    return readAdminPopupDeposits(profileId);
  }, [dbRevision, open, profileId]);

  const depositLogTotal = useMemo(
    () => roundMoney(depositLog.reduce((sum, entry) => sum + entry.amount, 0)),
    [depositLog],
  );

  const savedSchedule = useMemo(() => {
    void dbRevision;
    if (!open || !profileId) return null;
    return getMemberYieldSchedule(profileId);
  }, [dbRevision, open, profileId]);

  const standingPercent = savedSchedule ? String(savedSchedule.percent) : "0";
  const standingInterval = savedSchedule?.interval ?? "monthly";
  const draftForMember = yieldDraft?.profileId === profileId ? yieldDraft : null;
  const yieldPercent = draftForMember ? draftForMember.percent : standingPercent;
  const yieldInterval = draftForMember ? draftForMember.interval : standingInterval;

  useEffect(() => {
    if (!open || !profileId) return;

    setCurrentBalance(readCurrentBalance(profileId));
    setDepositInput("");
    setError("");
    setSaved(false);
    setSaving(false);
    setLastDeposit(0);
    setYieldDraft(null);
    setYieldError("");
    setYieldSaved(false);
    setYieldSaving(false);
  }, [open, profileId]);

  useEffect(() => {
    if (!open || !profileId) return;
    setCurrentBalance(readCurrentBalance(profileId));
  }, [open, profileId, dbRevision]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, yieldPercent, yieldInterval]);

  if (!open || !member || !profileId) return null;

  const displayName = resolveMemberLabel(profileId, member);
  const handle = member.handle || (member.username ? `@${member.username}` : "");
  const profile = findDadProfileById(profileId);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    const amount = parseMoneyInput(depositInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t("pages.admin.memberBalanceDepositInvalid"));
      return;
    }

    setSaving(true);
    try {
      const note = ADMIN_POPUP_DEPOSIT_MEMO;
      const checkingLedger = depositToMemberAccount(profileId, "checking", amount, note);
      if (!checkingLedger) {
        setError(t("pages.admin.memberDetailBalancesFailed"));
        return;
      }

      // Mirror into escrow so community liquidity / pool totals pick up the deposit.
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

      appendDataRecord("contributions", "wallet-deposit", {
        type: "wallet-deposit",
        source: ADMIN_POPUP_DEPOSIT_SOURCE,
        amount,
        reminderEnabled: false,
        recurringEnabled: false,
        profileId,
        memberId: profileId,
        memberName: displayName,
        handle: handle || `@${profile?.username ?? "member"}`,
        contributedAt: new Date().toISOString(),
        status: "completed",
        memo: note,
      });

      // Directory contributed/equity follow live investment stats (nets redemptions).
      applyMemberStatsFromContributions(profileId);
      const live = computeMemberStatsFromContributions(profileId);
      adminSetMemberDirectoryBalances(profileId, {
        contributed: live.contributed,
        equity: live.equity,
      });

      if (profile) {
        logProfileActivity({
          profileId: profile.id,
          proId: profile.proId,
          type: "donation",
          summary: `Admin deposit of $${amount.toFixed(2)}`,
          payload: { amount, source: ADMIN_POPUP_DEPOSIT_SOURCE },
        });
      }

      syncPoolInflowMetrics();
      syncMemberEscrowToLiquidityPool();

      const balance = readCurrentBalance(profileId);
      setCurrentBalance(balance);
      setLastDeposit(amount);
      setDepositInput("");
      setSaved(true);

      try {
        const { isFactoryZeroLocked, pushCloudBinsNow } = await import(
          "../../lib/supabase/cloudSync"
        );
        // Never unlock blank wipe just to push deposits — that resurrected old ledgers.
        if (isFactoryZeroLocked()) {
          /* keep lock; blank-platform bin guard will allow only $0 docs */
        }
        await pushCloudBinsNow(
          [
            { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
            { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
            { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
          ],
          { force: true },
        );
      } catch {
        // Local deposit already succeeded; cloud push can retry later.
      }
    } catch {
      setError(t("pages.admin.memberDetailBalancesFailed"));
    } finally {
      setSaving(false);
    }
  };

  const commitYield = async (percentRaw, interval, { announce = true } = {}) => {
    const percent = parseYieldPercent(percentRaw);
    if (percent == null || !isYieldInterval(interval)) {
      if (announce) setYieldError(t("pages.admin.memberYieldInvalid"));
      return false;
    }

    const existing = getMemberYieldSchedule(profileId);
    const rounded = Math.round(percent * 10000) / 10000;
    if (existing && existing.percent === rounded && existing.interval === interval) {
      setYieldDraft(null);
      if (announce) setYieldSaved(true);
      return true;
    }

    if (announce) setYieldSaving(true);
    setYieldError("");
    setYieldSaved(false);
    try {
      const result = saveMemberYieldSchedule(profileId, percent, interval);
      if (!result.ok) {
        setYieldError(t("pages.admin.memberYieldFailed"));
        return false;
      }
      setYieldDraft(null);
      if (announce) setYieldSaved(true);
      try {
        const { pushSavedYieldSchedules } = await import("../../lib/supabase/cloudSync");
        await pushSavedYieldSchedules();
      } catch {
        // Local rate already saved; cloud push can retry later.
      }
      return true;
    } catch {
      setYieldError(t("pages.admin.memberYieldFailed"));
      return false;
    } finally {
      if (announce) setYieldSaving(false);
    }
  };

  const handleSaveYield = () => commitYield(yieldPercent, yieldInterval);

  const closeSheet = () => {
    if (draftForMember && String(draftForMember.percent).trim()) {
      void commitYield(draftForMember.percent, draftForMember.interval, { announce: false });
    }
    onClose();
  };

  const restoreStandingYield = () => {
    setYieldDraft(null);
  };

  const yieldIntervalLabel = t(`pages.admin.memberYieldIntervals.${yieldInterval}`);
  const appliedPercent = parseYieldPercent(yieldPercent) ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={closeSheet}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-member-balance-title"
        className="dda-admin-member-sheet relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden sm:max-h-[88dvh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="dda-admin-member-sheet__header">
          <div className="min-w-0">
            <p className="dda-admin-member-sheet__kicker">{t("pages.admin.memberBalanceKicker")}</p>
            <h2 id="admin-member-balance-title" className="dda-admin-member-sheet__title">
              {displayName}
            </h2>
            {handle ? <p className="dda-admin-member-sheet__meta">{handle}</p> : null}
          </div>
          <button
            type="button"
            onClick={closeSheet}
            aria-label={t("common.close")}
            className="dda-admin-member-sheet__close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="dda-scroll space-y-5 overflow-y-auto px-5 py-5">
          <p className="text-[12px] leading-relaxed text-gray-500">
            {t("pages.admin.memberBalanceNote")}
          </p>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {t("pages.admin.memberBalanceCurrent")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-white">
              {formatPoolCurrency(currentBalance)}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {t("pages.admin.memberYieldKicker")}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                {t("pages.admin.memberYieldNote")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block" htmlFor="member-yield-percent">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.admin.memberYieldPercent")}
                </span>
                <span className="dda-admin-member-balance-card__field">
                  <input
                    id="member-yield-percent"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={yieldPercent}
                    placeholder="0"
                    onChange={(event) => {
                      setYieldDraft({
                        profileId,
                        percent: sanitizeMoneyTyping(event.target.value),
                        interval: yieldInterval,
                      });
                      setYieldSaved(false);
                    }}
                    onBlur={() => {
                      if (!String(yieldPercent).trim()) {
                        restoreStandingYield();
                        return;
                      }
                      void commitYield(yieldPercent, yieldInterval, { announce: false });
                    }}
                    className="dda-admin-member-balance-card__input dda-admin-member-yield__input"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSaveYield();
                      }
                    }}
                  />
                  <span className="dda-admin-member-balance-card__currency" aria-hidden="true">
                    %
                  </span>
                </span>
              </label>
              <label className="block" htmlFor="member-yield-interval">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.admin.memberYieldInterval")}
                </span>
                <select
                  id="member-yield-interval"
                  value={yieldInterval}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!isYieldInterval(next)) return;
                    setYieldDraft({ profileId, percent: yieldPercent, interval: next });
                    setYieldSaved(false);
                    if (!String(yieldPercent).trim()) return;
                    void commitYield(yieldPercent, next, { announce: false });
                  }}
                  className="dda-member-yield-interval"
                >
                  <option value="daily">{t("pages.admin.memberYieldIntervals.daily")}</option>
                  <option value="weekly">{t("pages.admin.memberYieldIntervals.weekly")}</option>
                  <option value="monthly">{t("pages.admin.memberYieldIntervals.monthly")}</option>
                </select>
              </label>
            </div>
            {yieldError ? <p className="text-sm text-red-400">{yieldError}</p> : null}
            {yieldSaved ? (
              <p className="text-sm text-dda-green-light">
                {t("pages.admin.memberYieldSaved", {
                  percent: yieldPercent,
                  interval: yieldIntervalLabel,
                })}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleSaveYield}
              disabled={yieldSaving}
              className="dda-btn-primary w-full sm:w-auto"
            >
              {yieldSaving ? t("pages.admin.memberYieldSaving") : t("pages.admin.memberYieldSave")}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
          <div className="dda-admin-member-balance-card">
            <label htmlFor="member-balance-checking" className="dda-admin-member-balance-card__label">
              {t("pages.admin.memberDetailBalanceChecking")}
            </label>
            <div className="dda-admin-member-balance-card__field">
              <span className="dda-admin-member-balance-card__currency" aria-hidden="true">
                $
              </span>
              <input
                id="member-balance-checking"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={depositInput}
                placeholder="0.00"
                onFocus={(event) => {
                  event.target.select();
                }}
                onChange={(event) => {
                  setDepositInput(sanitizeMoneyTyping(event.target.value));
                  setSaved(false);
                }}
                onBlur={() => {
                  const amount = parseMoneyInput(depositInput);
                  if (!depositInput.trim()) return;
                  if (Number.isFinite(amount) && amount >= 0) {
                    setDepositInput(formatMoneyAmount(amount));
                  }
                }}
                className="dda-admin-member-balance-card__input"
                autoFocus
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {saved ? (
            <p className="text-sm text-dda-green-light">
              {t("pages.admin.memberBalanceDepositSaved", {
                amount: formatPoolCurrency(lastDeposit),
                balance: formatPoolCurrency(currentBalance),
              })}
            </p>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.admin.memberBalanceDepositLog")}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {depositLog.length
                    ? t("pages.admin.memberBalanceDepositLogTotal", {
                        count: depositLog.length.toLocaleString(),
                        amount: formatPoolCurrency(depositLogTotal),
                      })
                    : t("pages.admin.memberBalanceDepositLogEmpty")}
                </p>
              </div>
            </div>

            {depositLog.length ? (
              <ul className="dda-scroll max-h-48 divide-y divide-white/5 overflow-y-auto">
                {depositLog.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {formatPoolCurrency(entry.amount)}
                      </p>
                      <p className="truncate text-[11px] text-gray-500">
                        {entry.contributedAt
                          ? formatEasternDateTime(entry.contributedAt, locale)
                          : "—"}
                      </p>
                      <p className="truncate text-[11px] tabular-nums text-dda-green-light">
                        {t("pages.admin.memberBalanceDepositYield", {
                          percent: String(appliedPercent),
                          interval: yieldIntervalLabel,
                          amount: formatYieldMoney(entry.amount * appliedPercent / 100),
                        })}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-dda-green-light">
                      {t("pages.admin.memberBalanceDepositAction")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={closeSheet}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white sm:flex-none"
            >
              {t("pages.admin.profileEditCancel")}
            </button>
            <button type="submit" disabled={saving} className="dda-btn-primary flex-1 sm:flex-none">
              {saving ? t("pages.admin.memberBalanceSaving") : t("pages.admin.memberBalanceDepositAction")}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
