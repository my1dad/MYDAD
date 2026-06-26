import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { APPLE_PAY_LOGO_URL, ZELLE_LOGO_URL } from "@/lib/assetUrl";
import { useLocale } from "../../i18n/LocaleContext";

const FUNDING_TABS = [
  {
    id: "apple-pay",
    labelKey: "fundingApplePay",
    renderIcon: (className) => (
      <img
        src={APPLE_PAY_LOGO_URL}
        alt=""
        draggable={false}
        className={cn("dda-wallet-funding-tab__logo dda-wallet-funding-tab__logo--apple", className)}
      />
    ),
  },
  {
    id: "zelle",
    labelKey: "fundingZelle",
    renderIcon: (className) => (
      <img
        src={ZELLE_LOGO_URL}
        alt=""
        draggable={false}
        className={cn("dda-wallet-funding-tab__logo dda-wallet-funding-tab__logo--zelle", className)}
      />
    ),
  },
  {
    id: "crypto",
    labelKey: "fundingSendCrypto",
    renderIcon: (className) => (
      <Coins className={cn("dda-wallet-funding-tab__icon", className)} strokeWidth={2} aria-hidden="true" />
    ),
  },
];

export default function WalletFundingTabs() {
  const { t } = useLocale();

  return (
    <div
      className="dda-wallet-funding-tabs"
      role="group"
      aria-label={t("pages.accounts.fundingMethodsAria")}
    >
      {FUNDING_TABS.map(({ id, labelKey, renderIcon }) => (
        <button
          key={id}
          type="button"
          className="dda-glass-btn dda-wallet-funding-tab"
        >
          {renderIcon()}
          <span className="dda-wallet-funding-tab__label">{t(`pages.accounts.${labelKey}`)}</span>
        </button>
      ))}
    </div>
  );
}
