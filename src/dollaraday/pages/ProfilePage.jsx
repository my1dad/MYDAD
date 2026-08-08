import { lazy, Suspense, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext";
import {
  ensureProfileAccountNumbers,
  formatGroupedAccountNumber,
  formatMaskedAccountNumber,
  getProfileAccountNumber,
} from "../lib/dadProfileStorage";

const MemberSettingsCard = lazy(() => import("../components/members/MemberSettingsCard"));
const AdminSettingsCard = lazy(() => import("../components/admin/AdminSettingsCard"));

function PanelSlot() {
  return <div className="dda-glass min-h-[200px] animate-pulse rounded-2xl" aria-hidden="true" />;
}

export default function ProfilePage() {
  const { t } = useLocale();
  const { isAdmin, profile } = useDadAuth();
  const [accountVisible, setAccountVisible] = useState(false);
  const [accountNumber, setAccountNumber] = useState(() =>
    profile?.id ? getProfileAccountNumber(profile.id) : null,
  );

  useEffect(() => {
    if (!profile?.id) {
      setAccountNumber(null);
      return;
    }
    ensureProfileAccountNumbers();
    setAccountNumber(getProfileAccountNumber(profile.id));
  }, [profile?.id, profile?.accountNumber]);

  const accountDisplay = accountVisible
    ? formatGroupedAccountNumber(accountNumber)
    : formatMaskedAccountNumber(accountNumber);
  const RevealIcon = accountVisible ? EyeOff : Eye;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.profile.title")}
        description={t("pages.profile.description")}
      />
      {profile?.proId || accountNumber ? (
        <div className="dda-panel rounded-xl border border-dda-green/20 px-4 py-3 sm:px-5 sm:py-4">
          {profile?.proId ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dda-green-light">
                {t("pages.profile.proIdCardTitle")}
              </p>
              <p className="mt-2 font-mono text-lg font-bold tracking-wide text-white sm:text-xl">
                {profile.proId}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                {t("pages.profile.proIdCardSub")}
              </p>
            </>
          ) : null}

          {accountNumber ? (
            <div className={profile?.proId ? "mt-4 border-t border-white/10 pt-4" : undefined}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dda-green-light">
                {t("pages.profile.accountNumberTitle")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <p
                  className="min-w-0 font-mono text-lg font-bold tracking-wide text-white sm:text-xl"
                  aria-live="polite"
                >
                  {accountDisplay}
                </p>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 transition hover:bg-white/10 hover:text-white"
                  aria-label={t(
                    accountVisible
                      ? "pages.profile.accountNumberHide"
                      : "pages.profile.accountNumberShow",
                  )}
                  aria-pressed={accountVisible}
                  onClick={() => setAccountVisible((visible) => !visible)}
                >
                  <RevealIcon className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                {t("pages.profile.accountNumberSub")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <Suspense fallback={<PanelSlot />}>
        {isAdmin ? <AdminSettingsCard /> : <MemberSettingsCard embedded />}
      </Suspense>
    </div>
  );
}
