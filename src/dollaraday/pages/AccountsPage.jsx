import { useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import AccountDetailView from "../components/accounts/AccountDetailView";
import AccountHubView from "../components/accounts/AccountHubView";
import { useLocale } from "../i18n/LocaleContext";

export default function AccountsPage() {
  const { t } = useLocale();
  const [selectedAccount, setSelectedAccount] = useState(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.accounts.title")}
        description={t("pages.accounts.description")}
      />

      {selectedAccount ? (
        <AccountDetailView accountId={selectedAccount} onBack={() => setSelectedAccount(null)} />
      ) : (
        <AccountHubView onSelectAccount={setSelectedAccount} />
      )}
    </div>
  );
}
