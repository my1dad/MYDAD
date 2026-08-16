import PageHeader from "../components/layout/PageHeader";
import AccountHubView from "../components/accounts/AccountHubView";
import { useDadAuth } from "../context/DadAuthContext.jsx";
import { useLocale } from "../i18n/LocaleContext";

export default function AccountsPage({ onNavigate }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const pageKey = isAdmin ? "accounts" : "wallet";

  return (
    <div className="dda-accounts-page space-y-2.5 sm:space-y-3 lg:space-y-6">
      <PageHeader
        title={t(`pages.${pageKey}.title`)}
        description={t(`pages.${pageKey}.description`)}
        className="dda-accounts-page__header"
      />

      <AccountHubView onNavigate={onNavigate} />
    </div>
  );
}
