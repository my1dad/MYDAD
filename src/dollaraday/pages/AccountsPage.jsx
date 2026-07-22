import { useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import AccountDetailView from "../components/accounts/AccountDetailView";
import AccountHubView from "../components/accounts/AccountHubView";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext";

export default function AccountsPage() {
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
        <AccountDetailView accountId={selectedAccount} onBack={() => setSelectedAccount(null)} />
      ) : (
        <AccountHubView onSelectAccount={setSelectedAccount} />
      )}
    </div>
  );
}
