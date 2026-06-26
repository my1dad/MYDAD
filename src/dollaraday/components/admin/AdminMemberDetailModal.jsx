import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isAdminProfile } from "../../../config/admin";
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
  getDadProfileRevision,
  getProfileApprovalStatus,
  subscribeDadProfiles,
} from "../../lib/dadProfileStorage";
import { buildAdminMemberDetail, getProfileMemberRoi } from "../../lib/profileRegistry";

function DetailSection({ title, children }) {
  return (
    <section className="dda-admin-member-detail__section">
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

export default function AdminMemberDetailModal({ profileId, open, onClose, onProfileDeleted }) {
  const { t } = useLocale();
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const profileRevision = useSyncExternalStore(
    subscribeDadProfiles,
    getDadProfileRevision,
    getDadProfileRevision,
  );
  const detail = useMemo(
    () => (open && profileId ? buildAdminMemberDetail(profileId) : null),
    [open, profileId, profileRevision],
  );

  useEffect(() => {
    if (!open) return;
    setActionError("");
    setEditOpen(false);
  }, [open, profileId]);

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

  if (!open || !detail) return null;

  const { record, contributions, posts, activity, transactions, profile } = detail;
  const isProtected = isAdminProfile(profile);
  const isSuspended = profile.accountStatus === "suspended";
  const approvalStatus = getProfileApprovalStatus(profile);
  const isPending = approvalStatus === "pending";
  const isDenied = approvalStatus === "denied";
  const roi = getProfileMemberRoi(record);
  const roiPositive = roi.amount >= 0;
  const roiSign = roiPositive ? "+" : "−";

  const handleDelete = () => {
    if (!window.confirm(t("pages.admin.profileDeleteConfirm", { name: record.name }))) return;
    if (!window.confirm(t("pages.admin.profileDeleteConfirmFinal", { name: record.name }))) return;
    const result = deleteDadProfileByAdmin(profileId);
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

    const result = isSuspended
      ? unsuspendDadProfileByAdmin(profileId)
      : suspendDadProfileByAdmin(profileId);
    if (!result.ok) {
      setActionError(result.error);
    }
  };

  const handleApprove = () => {
    if (!window.confirm(t("pages.admin.profileApproveConfirm", { name: record.name }))) return;
    const result = approveDadProfileByAdmin(profileId);
    if (!result.ok) {
      setActionError(result.error);
    }
  };

  const handleDeny = () => {
    if (!window.confirm(t("pages.admin.profileDenyConfirm", { name: record.name }))) return;
    const result = denyDadProfileByAdmin(profileId);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    onClose();
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
        className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <MemberAvatar
              initials={record.name?.slice(0, 2).toUpperCase() || "?"}
              imageUrl={record.profilePhotoUrl}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
                {t("pages.admin.memberDetailKicker")}
              </p>
              <h2 id="admin-member-detail-title" className="mt-1 truncate text-lg font-semibold text-white">
                {record.name}
              </h2>
              {isPending ? (
                <span className="mt-2 inline-block">
                  <Badge variant="warning">{t("pages.admin.profilePendingBadge")}</Badge>
                </span>
              ) : null}
              {isDenied ? (
                <span className={cn("inline-block", isPending ? "ml-2" : "mt-2")}>
                  <Badge variant="danger">{t("pages.admin.profileDeniedBadge")}</Badge>
                </span>
              ) : null}
              {isSuspended && !isPending && !isDenied ? (
                <span className="mt-2 inline-block">
                  <Badge variant="warning">{t("pages.admin.profileSuspendedBadge")}</Badge>
                </span>
              ) : null}
              <p className="mt-1 text-sm text-gray-500">
                {record.username ? `@${record.username}` : record.handle}
                {record.proId ? ` · ${record.proId}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!isProtected ? (
          <div className="dda-admin-member-detail__actions border-b border-white/10 px-5 py-3">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="dda-admin-member-detail__action dda-admin-member-detail__action--approve"
                >
                  {t("pages.admin.profileApprove")}
                </button>
                <span className="dda-admin-member-detail__action-sep" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={handleDeny}
                  className="dda-admin-member-detail__action dda-admin-member-detail__action--danger"
                >
                  {t("pages.admin.profileDeny")}
                </button>
                <span className="dda-admin-member-detail__action-sep" aria-hidden="true">
                  |
                </span>
              </>
            ) : null}
            <button
              type="button"
              onClick={handleDelete}
              className="dda-admin-member-detail__action dda-admin-member-detail__action--danger"
            >
              {t("pages.admin.profileDelete")}
            </button>
            {!isPending ? (
              <>
                <span className="dda-admin-member-detail__action-sep" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={handleSuspendToggle}
                  className="dda-admin-member-detail__action dda-admin-member-detail__action--warn"
                >
                  {isSuspended ? t("pages.admin.profileReactivate") : t("pages.admin.profileSuspend")}
                </button>
              </>
            ) : null}
            <span className="dda-admin-member-detail__action-sep" aria-hidden="true">
              |
            </span>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="dda-admin-member-detail__action"
            >
              {t("pages.admin.profileEdit")}
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p className="border-b border-white/10 px-5 py-2 text-sm text-red-400">{actionError}</p>
        ) : null}

        <div className="dda-scroll overflow-y-auto px-5 py-4">
          <DetailSection title={t("pages.admin.memberDetailIdentity")}>
            <div className="dda-admin-member-detail__grid">
              <DetailRow label={t("pages.admin.proId")} value={record.proId} mono />
              <DetailRow label={t("pages.admin.memberDetailRole")} value={record.tier} />
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
            <div className="dda-panel rounded-xl p-3">
              <DetailRow label={t("login.username")} value={record.username ? `@${record.username}` : "—"} mono />
              <DetailRow
                label={t("login.password")}
                value={record.password}
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
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("common.equity")}</p>
                <p className="mt-1 font-bold text-dda-green-light">${record.equity.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("common.score")}</p>
                <p className="mt-1 font-bold text-white">{record.score}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">
                  {t("pages.admin.memberDetailRoi")}
                </p>
                <p
                  className={cn(
                    "mt-1 font-bold tabular-nums",
                    roiPositive ? "text-dda-green-light" : "text-red-400",
                  )}
                >
                  {roiSign}
                  {formatPoolCurrency(Math.abs(roi.amount))}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] tabular-nums",
                    roiPositive ? "text-gray-500" : "text-red-400/80",
                  )}
                >
                  {roiPositive ? "+" : "−"}
                  {Math.abs(roi.pct).toFixed(2)}%
                </p>
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
          onClose={() => setEditOpen(false)}
        />
      </div>
    </div>,
    document.body,
  );
}
