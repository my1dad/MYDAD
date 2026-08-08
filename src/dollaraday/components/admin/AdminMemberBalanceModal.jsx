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
import {
  adminSetMemberDirectoryBalances,
  findStoredMemberByProfileId,
} from "../../lib/memberRegistry";
import { getDadProfiles } from "../../lib/dadProfileStorage";
import { pushCloudBinsNow } from "../../lib/supabase/cloudSync";

function moneyInputValue(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return String(amount);
}

function resolveMemberLabel(profileId, member) {
  if (member?.name) return member.name;
  const profile = getDadProfiles().find((item) => item.id === profileId);
  return profile?.displayName || profile?.fullName || member?.handle || "Member";
}

export default function AdminMemberBalanceModal({ member, open, onClose }) {
  const { t } = useLocale();
  const profileId = member?.profileId ?? member?.id ?? "";
  const [checkingInput, setCheckingInput] = useState("0");
  const [escrowInput, setEscrowInput] = useState("0");
  const [contributedInput, setContributedInput] = useState("0");
  const [equityInput, setEquityInput] = useState("0");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !profileId) return;

    const stored = findStoredMemberByProfileId(profileId);
    const wallet = getMemberAccountLedger(profileId);
    setCheckingInput(moneyInputValue(wallet.checkingBalance));
    setEscrowInput(moneyInputValue(wallet.escrowBalance));
    setContributedInput(moneyInputValue(stored?.contributed ?? member?.contributed ?? 0));
    setEquityInput(moneyInputValue(stored?.equity ?? member?.equity ?? 0));
    setError("");
    setSaved(false);
    setSaving(false);
  }, [open, profileId, member?.contributed, member?.equity]);

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

    const checking = Number(checkingInput);
    const escrow = Number(escrowInput);
    const contributed = Number(contributedInput);
    const equity = Number(equityInput);

    if ([checking, escrow, contributed, equity].some((value) => !Number.isFinite(value) || value < 0)) {
      setError(t("pages.admin.memberDetailBalancesInvalid"));
      return;
    }

    setSaving(true);
    try {
      const updated = adminSetMemberDirectoryBalances(profileId, { contributed, equity });
      if (!updated) {
        setError(t("pages.admin.memberDetailBalancesFailed"));
        return;
      }
      adminSetMemberWalletBalances(profileId, { checking, escrow });

      try {
        await pushCloudBinsNow([
          { binId: DATA_BIN_BY_KEY.members.binId, document: readDataBin("members") },
          { binId: DATA_BIN_BY_KEY.settings.binId, document: readDataBin("settings") },
        ]);
      } catch {
        // Local save already succeeded; cloud push can retry later.
      }

      setSaved(true);
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
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-dda-bg shadow-2xl sm:max-h-[88dvh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dda-accent-bar" />

        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-dda-green-light">
              {t("pages.admin.memberBalanceKicker")}
            </p>
            <h2 id="admin-member-balance-title" className="mt-1 truncate text-lg font-semibold text-white">
              {displayName}
            </h2>
            {handle ? <p className="mt-1 text-sm text-gray-500">{handle}</p> : null}
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

        <form onSubmit={handleSubmit} className="dda-scroll space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-[11px] leading-relaxed text-gray-500">
            {t("pages.admin.memberBalanceNote")}
          </p>

          <div className="dda-admin-member-detail__balance-grid">
            <div>
              <label htmlFor="member-balance-contributed" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("pages.admin.memberDetailContributed")}
              </label>
              <input
                id="member-balance-contributed"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={contributedInput}
                onChange={(event) => {
                  setContributedInput(event.target.value);
                  setSaved(false);
                }}
                className="dda-input"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="member-balance-equity" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("common.equity")}
              </label>
              <input
                id="member-balance-equity"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={equityInput}
                onChange={(event) => {
                  setEquityInput(event.target.value);
                  setSaved(false);
                }}
                className="dda-input"
              />
            </div>
            <div>
              <label htmlFor="member-balance-checking" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("pages.admin.memberDetailBalanceChecking")}
              </label>
              <input
                id="member-balance-checking"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={checkingInput}
                onChange={(event) => {
                  setCheckingInput(event.target.value);
                  setSaved(false);
                }}
                className="dda-input"
              />
            </div>
            <div>
              <label htmlFor="member-balance-escrow" className="mb-1.5 block text-xs font-semibold text-gray-400">
                {t("pages.admin.memberDetailBalanceEscrow")}
              </label>
              <input
                id="member-balance-escrow"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={escrowInput}
                onChange={(event) => {
                  setEscrowInput(event.target.value);
                  setSaved(false);
                }}
                className="dda-input"
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
              className="flex-1 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5 hover:text-white sm:flex-none"
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
