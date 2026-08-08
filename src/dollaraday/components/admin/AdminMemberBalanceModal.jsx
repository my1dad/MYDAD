import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/modalBodyLock";
import { useLocale } from "../../i18n/LocaleContext";
import { DATA_BIN_BY_KEY } from "../../lib/dataBins";
import { readDataBin } from "../../lib/internalDatabase";
import {
  adminSetMemberWalletBalances,
  getMemberAccountLedger,
} from "../../lib/memberAccounts";
import { adminSetMemberDirectoryBalances } from "../../lib/memberRegistry";
import { getDadProfiles } from "../../lib/dadProfileStorage";
import { pushCloudBinsNow } from "../../lib/supabase/cloudSync";

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

export default function AdminMemberBalanceModal({ member, open, onClose }) {
  const { t } = useLocale();
  const profileId = member?.profileId ?? member?.id ?? "";
  const [checkingInput, setCheckingInput] = useState("0.00");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !profileId) return;

    const wallet = getMemberAccountLedger(profileId);
    setCheckingInput(formatMoneyAmount(wallet.checkingBalance));
    setError("");
    setSaved(false);
    setSaving(false);
  }, [open, profileId]);

  useEffect(() => {
    if (!open) return undefined;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !member || !profileId) return null;

  const displayName = resolveMemberLabel(profileId, member);
  const handle = member.handle || (member.username ? `@${member.username}` : "");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    const checking = parseMoneyInput(checkingInput);
    if (!Number.isFinite(checking) || checking < 0) {
      setError(t("pages.admin.memberDetailBalancesInvalid"));
      return;
    }

    setSaving(true);
    try {
      // Wallet checking is the admin-managed member balance; mirror it to the
      // directory contributed/equity fields so Members list + profile cards update.
      adminSetMemberWalletBalances(profileId, { checking });
      const directory = adminSetMemberDirectoryBalances(profileId, {
        contributed: checking,
        equity: checking,
      });
      if (!directory) {
        setError(t("pages.admin.memberDetailBalancesFailed"));
        return;
      }
      setCheckingInput(formatMoneyAmount(checking));

      try {
        await pushCloudBinsNow([
          { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
          { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
        ]);
      } catch {
        // Local save already succeeded; cloud push can retry later.
      }

      setSaved(true);
      onClose();
    } catch {
      setError(t("pages.admin.memberDetailBalancesFailed"));
    } finally {
      setSaving(false);
    }
  };

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
            onClick={onClose}
            aria-label={t("common.close")}
            className="dda-admin-member-sheet__close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dda-scroll space-y-5 overflow-y-auto px-5 py-5">
          <p className="text-[12px] leading-relaxed text-gray-500">
            {t("pages.admin.memberBalanceNote")}
          </p>

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
                value={checkingInput}
                onFocus={(event) => {
                  event.target.select();
                }}
                onChange={(event) => {
                  setCheckingInput(sanitizeMoneyTyping(event.target.value));
                  setSaved(false);
                }}
                onBlur={() => {
                  const amount = parseMoneyInput(checkingInput);
                  if (Number.isFinite(amount) && amount >= 0) {
                    setCheckingInput(formatMoneyAmount(amount));
                  } else {
                    setCheckingInput("0.00");
                  }
                }}
                className="dda-admin-member-balance-card__input"
                autoFocus
              />
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {saved ? (
            <p className="text-sm text-dda-green-light">{t("pages.admin.memberDetailBalancesSaved")}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white sm:flex-none"
            >
              {t("pages.admin.profileEditCancel")}
            </button>
            <button type="submit" disabled={saving} className="dda-btn-primary flex-1 sm:flex-none">
              {saving ? t("pages.admin.memberBalanceSaving") : t("pages.admin.memberDetailBalancesSave")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
