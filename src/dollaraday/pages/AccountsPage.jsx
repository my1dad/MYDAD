import { useState } from "react";
import { lazy, Suspense } from "react";
import PageHeader from "../components/layout/PageHeader";
import AccountHubView from "../components/accounts/AccountHubView";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext";

const AccountDetailView = lazy(() => import("../components/accounts/AccountDetailView"));

export default function AccountsPage({ onNavigate }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const [selectedAccount, setSelectedAccount] = useState(null);
  const pageKey = isAdmin ? "accounts" : "wallet";

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t(`pages.${pageKey}.title`)}
        description={t(`pages.${pageKey}.description`)}
      />

      {selectedAccount ? (
        <Suspense fallback={<div className="dda-glass min-h-[240px] animate-pulse rounded-2xl" aria-hidden="true" />}>
          <AccountDetailView accountId={selectedAccount} onBack={() => setSelectedAccount(null)} />
        </Suspense>
      ) : (
        <AccountHubView onSelectAccount={setSelectedAccount} onNavigate={onNavigate} />
      )}
    </div>
  );
}
