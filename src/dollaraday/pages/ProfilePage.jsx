import { lazy, Suspense } from "react";
import PageHeader from "../components/layout/PageHeader";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext";

const MemberSettingsCard = lazy(() => import("../components/members/MemberSettingsCard"));
const AdminSettingsCard = lazy(() => import("../components/admin/AdminSettingsCard"));

function PanelSlot() {
  return <div className="dda-glass min-h-[200px] animate-pulse rounded-2xl" aria-hidden="true" />;
}

export default function ProfilePage() {
  const { t } = useLocale();
  const { isAdmin, profile } = useDadAuth();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.profile.title")}
        description={t("pages.profile.description")}
      />
      {profile?.proId ? (
        <div className="dda-panel rounded-xl border border-dda-green/20 px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-dda-green-light">
            {t("pages.profile.proIdCardTitle")}
          </p>
          <p className="mt-2 font-mono text-lg font-bold tracking-wide text-white sm:text-xl">
            {profile.proId}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
            {t("pages.profile.proIdCardSub")}
          </p>
        </div>
      ) : null}
      <Suspense fallback={<PanelSlot />}>
        {isAdmin ? <AdminSettingsCard /> : <MemberSettingsCard embedded />}
      </Suspense>
    </div>
  );
}
