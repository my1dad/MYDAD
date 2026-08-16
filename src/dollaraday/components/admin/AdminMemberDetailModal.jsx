import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isAdminProfile } from "../../../config/admin";
import { resolveMembershipTier } from "../../../config/memberProfile";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { cn } from "@/lib/utils";
import { MemberAvatar, Badge } from "../layout/DashboardCard";
import AdminProfileEditModal from "./AdminProfileEditModal";
import { formatPoolCurrency } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";
import { formatEasternShortDate, formatEasternTimeWithZone } from "../../lib/dateTime";
import {
  approveDadProfileByAdmin,
  deleteDadProfileByAdmin,
  denyDadProfileByAdmin,
  suspendDadProfileByAdmin,
  unsuspendDadProfileByAdmin,
} from "../../lib/profileAdminActions";
import {
  findDadProfileById,
  findDadProfileByUsername,
  getDadProfileRevision,
  getDadProfiles,
  getProfileApprovalStatus,
  replaceDadProfilesLocal,
  subscribeDadProfiles,
} from "../../lib/dadProfileStorage";
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
  useMemberAccounts,
} from "../../lib/memberAccounts";
import {
  adminSetMemberDirectoryBalances,
  applyMemberStatsFromContributions,
} from "../../lib/memberRegistry";
import { computeMemberStatsFromContributions } from "../../lib/memberContributionStats";
import { logProfileActivity } from "../../lib/profileActivity";
import { buildAdminMemberDetail } from "../../lib/profileRegistry";
import { syncMemberEscrowToLiquidityPool, syncPoolInflowMetrics } from "../../lib/poolState";

const ADMIN_DETAIL_DEPOSIT_SOURCE = "admin-member-deposit";
const ADMIN_DETAIL_DEPOSIT_MEMO = "Admin deposit";

function DetailSection({ title, children, className }) {
  return (
    <section className={cn("dda-admin-member-detail__section", className)}>
      <h3 className="dda-admin-member-detail__section-title">{title}</h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value, mono = false, accent }) {
  return (
    <div className="dda-admin-member-detail__row">
      <span className="dda-admin-member-detail__label">{label}</span>
      <span
        className={cn(
          "dda-admin-member-detail__value",
          mono && "font-mono text-xs",
          accent,
        )}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return `${formatEasternShortDate(iso)} · ${formatEasternTimeWithZone(new Date(iso))}`;
  } catch {
    return iso;
  }
}

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

function formatMoneyDisplay(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function sanitizeMoneyTyping(value) {
  let next = String(value ?? "").replace(/[^0-9.]/g, "");
  const firstDot = next.indexOf(".");
  if (firstDot !== -1) {
    next = `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, "")}`;
  }
  return next;
}

export default function AdminMemberDetailModal({
  profileId,
  usernameHint = "",
  displayNameHint = "",
  open,
  onClose,
  onProfileDeleted,
}) {
  const { t } = useLocale();
  const [editOpen, setEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState(null);
  const [actionError, setActionError] = useState("");
  const [balanceError, setBalanceError] = useState("");
  const [balanceSaved, setBalanceSaved] = useState(false);
  const [checkingInput, setCheckingInput] = useState("");
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [lastDeposit, setLastDeposit] = useState(0);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [resolvedProfileId, setResolvedProfileId] = useState(profileId || "");
  const [actionBusy, setActionBusy] = useState(false);
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    getDadProfileRevision,
  );
  const databaseRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const activeProfileId = useMemo(() => {
    if (resolvedProfileId && buildAdminMemberDetail(resolvedProfileId)) {
      return resolvedProfileId;
    }
    if (profileId && buildAdminMemberDetail(profileId)) return profileId;
    if (usernameHint) {
      const byUsername = findDadProfileByUsername(usernameHint);
      if (byUsername) return byUsername.id;
    }
    return resolvedProfileId || profileId || "";
  }, [resolvedProfileId, profileId, usernameHint, profileRevision, databaseRevision]);

  const detail = useMemo(
    () => (open && activeProfileId ? buildAdminMemberDetail(activeProfileId) : null),
    [open, activeProfileId, profileRevision, databaseRevision],
  );
  const wallet = useMemberAccounts(activeProfileId || "");
  const currentEquity = useMemo(() => {
    if (!activeProfileId) return 0;
    return Math.round((Number(computeMemberStatsFromContributions(activeProfileId).equity) || 0) * 100) / 100;
  }, [activeProfileId, databaseRevision, wallet.checkingBalance, wallet.escrowBalance]);

  useEffect(() => {
    if (!open) return;
    setActionError("");
    setBalanceError("");
    setBalanceSaved(false);
    setProfileLoadFailed(false);
    setResolvedProfileId(profileId || "");
    setActionBusy(false);
  }, [open, profileId, usernameHint]);

  useEffect(() => {
    if (!open || detail) {
      setProfileLoading(false);
      return undefined;
    }
    if (!profileId && !usernameHint) {
      setProfileLoadFailed(true);
      setProfileLoading(false);
      return undefined;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileLoadFailed(false);

    void import("../../lib/supabase/cloudSync")
      .then(async ({ pullCloudProfilesNow, pullCloudProfileForAuth }) => {
        if (usernameHint) {
          await pullCloudProfileForAuth(usernameHint, getDadProfiles, replaceDadProfilesLocal);
          if (cancelled) return;
          const byUsername = findDadProfileByUsername(usernameHint);
          if (byUsername) {
            setResolvedProfileId(byUsername.id);
            return;
          }
        }
        await pullCloudProfilesNow(getDadProfiles, replaceDadProfilesLocal);
        if (cancelled) return;
        if (profileId && buildAdminMemberDetail(profileId)) {
          setResolvedProfileId(profileId);
          return;
        }
        if (usernameHint) {
          const byUsername = findDadProfileByUsername(usernameHint);
          if (byUsername) {
            setResolvedProfileId(byUsername.id);
            return;
          }
        }
        setProfileLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setProfileLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, profileId, usernameHint, detail]);

  useEffect(() => {
    if (!open || !detail) return;
    setCheckingInput("");
    setBalanceSaved(false);
    setBalanceError("");
  }, [open, activeProfileId, detail]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (editOpen) return;
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, editOpen]);

  const handleApproveMissing = async () => {
    const label = displayNameHint || usernameHint || "this member";
    if (!window.confirm(t("pages.admin.profileApproveConfirm", { name: label }))) return;
    setActionError("");
    setActionBusy(true);
    const result = await approveDadProfileByAdmin(activeProfileId || profileId || "", {
      username: usernameHint,
    });
    setActionBusy(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    if (result.profile?.id) setResolvedProfileId(result.profile.id);
    onClose();
  };

  const handleDenyMissing = async () => {
    const label = displayNameHint || usernameHint || "this member";
    if (!window.confirm(t("pages.admin.profileDenyConfirm", { name: label }))) return;
    setActionError("");
    setActionBusy(true);
    const result = await denyDadProfileByAdmin(activeProfileId || profileId || "", {
      username: usernameHint,
    });
    setActionBusy(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onClose();
  };

  if (!open) {
    if (editOpen && editProfile) {
      return (
        <AdminProfileEditModal
          profile={editProfile}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditProfile(null);
          }}
        />
      );
    }
    return null;
  }

  if (!detail) {
    const canAct = Boolean(usernameHint || profileId);
    return createPortal(
      <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <button
          type="button"
          aria-label={t("common.close")}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="dda-admin-member-sheet relative w-full max-w-md p-5"
        >
          <div className="dda-accent-bar" />
          {(displayNameHint || usernameHint) && !profileLoading ? (
            <div className="mb-3">
              <p className="text-lg font-semibold text-white">
                {displayNameHint || `@${usernameHint}`}
              </p>
              {usernameHint ? (
                <p className="text-sm text-gray-500">@{usernameHint}</p>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm text-gray-300">
            {profileLoading
              ? t("pages.admin.memberDetailLoading")
              : profileLoadFailed
                ? t("pages.admin.memberDetailMissing")
                : t("pages.admin.memberDetailLoading")}
          </p>
          {actionError ? <p className="mt-2 text-sm text-red-400">{actionError}</p> : null}
          {!profileLoading ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {canAct ? (
                <>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleApproveMissing}
                    className="dda-btn-primary disabled:opacity-50"
                  >
                    {t("pages.admin.profileApprove")}
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleDenyMissing}
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 disabled:opacity-50"
                  >
                    {t("pages.admin.profileDeny")}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-gray-300"
              >
                {t("common.close")}
              </button>
            </div>
          ) : null}
        </div>
      </div>,
      document.body,
    );
  }

  const { record, contributions, posts, activity, transactions, profile } = detail;
  const isProtected = isAdminProfile(profile);
  const isSuspended = profile.accountStatus === "suspended";
  const approvalStatus = getProfileApprovalStatus(profile);
  const isPending = approvalStatus === "pending";
  const isDenied = approvalStatus === "denied";

  const handleDelete = async () => {
    if (!window.confirm(t("pages.admin.profileDeleteConfirm", { name: record.name }))) return;
    if (!window.confirm(t("pages.admin.profileDeleteConfirmFinal", { name: record.name }))) return;
    setActionError("");
    const result = await deleteDadProfileByAdmin(activeProfileId || profileId);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onProfileDeleted?.();
    onClose();
  };

  const handleSuspendToggle = () => {
    const confirmKey = isSuspended
      ? "pages.admin.profileReactivateConfirm"
      : "pages.admin.profileSuspendConfirm";
    if (!window.confirm(t(confirmKey, { name: record.name }))) return;

    const targetId = activeProfileId || profileId;
    const result = isSuspended
      ? unsuspendDadProfileByAdmin(targetId)
      : suspendDadProfileByAdmin(targetId);
    if (!result.ok) {
      setActionError(result.error);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(t("pages.admin.profileApproveConfirm", { name: record.name }))) return;
    setActionError("");
    const result = await approveDadProfileByAdmin(activeProfileId || profileId, {
      username: record.username ?? profile.username ?? usernameHint,
    });
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onClose();
  };

  const handleDeny = async () => {
    if (!window.confirm(t("pages.admin.profileDenyConfirm", { name: record.name }))) return;
    setActionError("");
    const result = await denyDadProfileByAdmin(activeProfileId || profileId, {
      username: record.username ?? profile.username ?? usernameHint,
    });
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onClose();
  };

  const openEditSheet = () => {
    setEditProfile(profile);
    setEditOpen(true);
    onClose();
  };

  const handleBalanceSave = async (event) => {
    event.preventDefault();
    setBalanceError("");
    setBalanceSaved(false);

    const amount = parseMoneyInput(checkingInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBalanceError(t("pages.admin.memberBalanceDepositInvalid"));
      return;
    }

    const targetId = activeProfileId || profileId;
    if (!targetId) {
      setBalanceError(t("pages.admin.memberDetailBalancesFailed"));
      return;
    }

    setBalanceSaving(true);
    try {
      const note = ADMIN_DETAIL_DEPOSIT_MEMO;
      const checkingLedger = depositToMemberAccount(targetId, "checking", amount, note);
      if (!checkingLedger) {
        setBalanceError(t("pages.admin.memberDetailBalancesFailed"));
        return;
      }

      // Mirror into escrow so community liquidity / pool totals pick up the deposit.
      const afterChecking = getMemberAccountLedger(targetId);
      const escrowGap =
        Math.round(
          (Math.max(
            0,
            (Number(afterChecking.checkingBalance) || 0) - (Number(afterChecking.escrowBalance) || 0),
          ) +
            Number.EPSILON) *
            100,
        ) / 100;
      if (escrowGap > 0) {
        depositToMemberAccount(targetId, "escrow", escrowGap, note);
      }

      const displayName = record?.name || detail?.name || "Member";
      const handle =
        detail?.handle ||
        (profile?.username ? `@${profile.username}` : "") ||
        (record?.username ? `@${record.username}` : "");

      appendDataRecord("contributions", "wallet-deposit", {
        type: "wallet-deposit",
        source: ADMIN_DETAIL_DEPOSIT_SOURCE,
        amount,
        reminderEnabled: false,
        recurringEnabled: false,
        profileId: targetId,
        memberId: targetId,
        memberName: displayName,
        handle: handle || "@member",
        contributedAt: new Date().toISOString(),
        status: "completed",
        memo: note,
      });

      applyMemberStatsFromContributions(targetId);
      const live = computeMemberStatsFromContributions(targetId);
      adminSetMemberDirectoryBalances(targetId, {
        contributed: live.contributed,
        equity: live.equity,
      });

      const memberProfile = findDadProfileById(targetId) || profile;
      if (memberProfile) {
        logProfileActivity({
          profileId: memberProfile.id,
          proId: memberProfile.proId,
          type: "donation",
          summary: `Admin deposit of $${amount.toFixed(2)}`,
          payload: { amount, source: ADMIN_DETAIL_DEPOSIT_SOURCE },
        });
      }

      syncPoolInflowMetrics();
      syncMemberEscrowToLiquidityPool();

      try {
        const { isFactoryZeroLocked, pushCloudBinsNow: pushBins } = await import(
          "../../lib/supabase/cloudSync"
        );
        if (isFactoryZeroLocked()) {
          /* keep lock; blank-platform bin guard will allow only $0 docs */
        }
        await pushBins(
          [
            { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
            { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
            { binId: DATA_BIN_BY_KEY.contributions.binId, document: readDataBin("contributions") },
          ],
          { force: true },
        );
      } catch {
        // Local save already succeeded; cloud can retry on next sync.
      }

      setCheckingInput("");
      setLastDeposit(amount);
      setBalanceSaved(true);
    } catch {
      setBalanceError(t("pages.admin.memberDetailBalancesFailed"));
    } finally {
      setBalanceSaving(false);
    }
  };

  const sessionEvents = activity;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-member-detail-title"
        className="dda-admin-member-sheet relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden sm:max-h-[88dvh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <header className="dda-admin-member-sheet__header">
          <div className="flex min-w-0 items-start gap-3.5">
            <MemberAvatar
              initials={record.name?.slice(0, 2).toUpperCase() || "?"}
              imageUrl={record.profilePhotoUrl}
              size="lg"
            />
            <div className="min-w-0">
              <p className="dda-admin-member-sheet__kicker">
                {t("pages.admin.memberDetailKicker")}
              </p>
              <h2 id="admin-member-detail-title" className="dda-admin-member-sheet__title">
                {record.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isPending ? (
                  <Badge variant="warning">{t("pages.admin.profilePendingBadge")}</Badge>
                ) : null}
                {isDenied ? (
                  <Badge variant="danger">{t("pages.admin.profileDeniedBadge")}</Badge>
                ) : null}
                {isSuspended && !isPending && !isDenied ? (
                  <Badge variant="warning">{t("pages.admin.profileSuspendedBadge")}</Badge>
                ) : null}
                <span className="dda-admin-member-sheet__chip">
                  {record.username ? `@${record.username}` : record.handle}
                </span>
                {record.proId ? (
                  <span className="dda-admin-member-sheet__chip dda-admin-member-sheet__chip--gold">
                    {record.proId}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="dda-admin-member-sheet__close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!isProtected ? (
          <div className="dda-admin-member-detail__actions">
            {isPending || isDenied ? (
              <button
                type="button"
                onClick={handleApprove}
                className="dda-admin-member-detail__pill dda-admin-member-detail__pill--approve"
              >
                {t("pages.admin.profileApprove")}
              </button>
            ) : null}
            {isPending ? (
              <button
                type="button"
                onClick={handleDeny}
                className="dda-admin-member-detail__pill dda-admin-member-detail__pill--danger"
              >
                {t("pages.admin.profileDeny")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDelete}
              className="dda-admin-member-detail__pill dda-admin-member-detail__pill--danger"
            >
              {t("pages.admin.profileDelete")}
            </button>
            {!isPending ? (
              <button
                type="button"
                onClick={handleSuspendToggle}
                className="dda-admin-member-detail__pill dda-admin-member-detail__pill--warn"
              >
                {isSuspended ? t("pages.admin.profileReactivate") : t("pages.admin.profileSuspend")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={openEditSheet}
              className="dda-admin-member-detail__pill"
            >
              {t("pages.admin.profileEdit")}
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p className="border-b border-white/10 px-5 py-2 text-sm text-red-400">{actionError}</p>
        ) : null}

        <div className="dda-scroll overflow-y-auto px-5 py-5">
          <DetailSection title={t("pages.admin.memberDetailBalances")} className="!mt-0 !border-0 !pt-0">
            <form onSubmit={handleBalanceSave} className="space-y-3">
              <p className="text-[12px] leading-relaxed text-gray-500">
                {t("pages.admin.memberDetailBalancesNote")}
              </p>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("pages.admin.memberBalanceCurrent")}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">
                  {formatPoolCurrency(currentEquity)}
                </p>
              </div>
              <div className="dda-admin-member-balance-card">
                <label htmlFor="admin-balance-checking" className="dda-admin-member-balance-card__label">
                  {t("pages.admin.memberDetailBalanceChecking")}
                </label>
                <div className="dda-admin-member-balance-card__field">
                  <span className="dda-admin-member-balance-card__currency" aria-hidden="true">
                    $
                  </span>
                  <input
                    id="admin-balance-checking"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={checkingInput}
                    placeholder="0.00"
                    onFocus={(event) => {
                      if (!checkingInput.trim()) {
                        setCheckingInput("");
                        return;
                      }
                      event.target.select();
                    }}
                    onChange={(event) => {
                      setCheckingInput(sanitizeMoneyTyping(event.target.value));
                      setBalanceSaved(false);
                    }}
                    onBlur={() => {
                      const amount = parseMoneyInput(checkingInput);
                      if (!checkingInput.trim()) return;
                      if (Number.isFinite(amount) && amount >= 0) {
                        setCheckingInput(formatMoneyAmount(amount));
                      }
                    }}
                    className="dda-admin-member-balance-card__input"
                  />
                </div>
              </div>
              {balanceError ? <p className="text-sm text-red-400">{balanceError}</p> : null}
              {balanceSaved ? (
                <p className="text-sm text-dda-green-light">
                  {t("pages.admin.memberBalanceDepositSaved", {
                    amount: formatPoolCurrency(lastDeposit),
                    balance: formatPoolCurrency(currentEquity),
                  })}
                </p>
              ) : null}
              <button type="submit" className="dda-btn-primary" disabled={balanceSaving}>
                {balanceSaving
                  ? t("pages.admin.memberBalanceSaving")
                  : t("pages.admin.memberBalanceDepositAction")}
              </button>
            </form>
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailIdentity")}>
            <div className="dda-admin-member-detail__grid">
              <DetailRow label={t("pages.admin.proId")} value={record.proId} mono />
              <DetailRow
                label={t("pages.admin.memberDetailRole")}
                value={t(`tier.${resolveMembershipTier(profile ?? record.tier)}`)}
              />
              <DetailRow
                label={t("pages.admin.memberDetailReferral")}
                value={
                  record.referredByProId
                    ? `${record.referredByProId}${record.referredByName ? ` · ${record.referredByName}` : ""}`
                    : "—"
                }
              />
              <DetailRow label={t("pages.admin.memberDetailJoined")} value={formatWhen(record.createdAt)} />
              <DetailRow
                label={t("pages.admin.memberDetailApproval")}
                value={t(`pages.admin.memberApprovalStatus.${approvalStatus}`)}
              />
            </div>
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailContact")}>
            <div className="dda-admin-member-detail__grid">
              <DetailRow label={t("pages.admin.memberDetailEmail")} value={record.email} />
              <DetailRow label={t("pages.admin.memberDetailPhone")} value={record.phone} />
            </div>
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailCredentials")}>
            <div className="dda-admin-member-detail__panel">
              <DetailRow label={t("login.username")} value={record.username ? `@${record.username}` : "—"} mono />
              <DetailRow
                label={t("login.password")}
                value={
                  record.password?.startsWith("pbkdf2$")
                    ? "•••••••• (set by member)"
                    : record.password || "—"
                }
                mono
                accent="text-amber-300"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                {t("pages.admin.memberDetailCredentialsNote")}
              </p>
            </div>
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailStats")}>
            <div className="dda-admin-member-detail__stats">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("common.days")}</p>
                <p className="mt-1 font-bold text-white">{record.days}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  {t("pages.admin.memberBalanceCurrent")}
                </p>
                <p className="mt-1 font-bold tabular-nums text-dda-green-light">
                  {formatMoneyDisplay(currentEquity)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("common.score")}</p>
                <p className="mt-1 font-bold text-white">{record.score}</p>
              </div>
            </div>
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailDonations", { count: contributions.length })}>
            {contributions.length ? (
              <ul className="dda-admin-member-detail__list">
                {contributions.map((entry) => (
                  <li key={entry.id} className="dda-admin-member-detail__list-item">
                    <div className="min-w-0">
                      <p className="font-medium text-white">
                        {entry.type === "signup"
                          ? t("pages.admin.memberDetailSignup")
                          : String(entry.type ?? "contribution")}
                      </p>
                      <p className="text-xs text-gray-500">{formatWhen(String(entry.contributedAt ?? ""))}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-dda-green-light">
                      {Number(entry.amount) > 0 ? formatPoolCurrency(Number(entry.amount)) : entry.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{t("pages.admin.memberDetailEmpty")}</p>
            )}
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailRequests", { count: transactions.length })}>
            {transactions.length ? (
              <ul className="dda-admin-member-detail__list">
                {transactions.slice(0, 12).map((entry) => (
                  <li key={entry.id} className="dda-admin-member-detail__list-item">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{entry.memo || entry.type}</p>
                      <p className="text-xs text-gray-500">
                        {entry.accountId} · {formatWhen(entry.createdAt)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-semibold tabular-nums",
                        entry.direction === "credit" ? "text-dda-green-light" : "text-gray-300",
                      )}
                    >
                      {entry.direction === "credit" ? "+" : "−"}
                      {formatPoolCurrency(entry.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{t("pages.admin.memberDetailEmpty")}</p>
            )}
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailPosts", { count: posts.length })}>
            {posts.length ? (
              <ul className="dda-admin-member-detail__list">
                {posts.map((entry) => (
                  <li key={entry.id} className="dda-admin-member-detail__list-item">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{entry.title}</p>
                      <p className="text-xs text-gray-500">{formatWhen(String(entry.publishedAt ?? ""))}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{t("pages.admin.memberDetailEmpty")}</p>
            )}
          </DetailSection>

          <DetailSection title={t("pages.admin.memberDetailActivity", { count: sessionEvents.length })}>
            {sessionEvents.length ? (
              <ul className="dda-admin-member-detail__timeline">
                {sessionEvents.map((entry) => (
                  <li key={entry.id} className="dda-admin-member-detail__timeline-item">
                    <span className="dda-admin-member-detail__timeline-type">{entry.type}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{entry.summary}</p>
                      <p className="text-xs text-gray-500">{formatWhen(entry.occurredAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">{t("pages.admin.memberDetailEmpty")}</p>
            )}
          </DetailSection>
        </div>

        <AdminProfileEditModal
          profile={profile}
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditProfile(null);
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
