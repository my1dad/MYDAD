import { useState } from "react";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { APPLE_PAY_LOGO_URL, ZELLE_LOGO_URL } from "@/lib/assetUrl";
import { useLocale } from "../../i18n/LocaleContext";
import ApplePaySmsModal from "../home/ApplePaySmsModal.jsx";
import ZellePayModal from "../home/ZellePayModal.jsx";

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
    comingSoon: true,
    renderIcon: (className) => (
      <Coins className={cn("dda-wallet-funding-tab__icon", className)} strokeWidth={2} aria-hidden="true" />
    ),
  },
];

export default function WalletFundingTabs() {
  const { t } = useLocale();
  const [applePayOpen, setApplePayOpen] = useState(false);
  const [zelleOpen, setZelleOpen] = useState(false);
  const [cryptoTipOpen, setCryptoTipOpen] = useState(false);

  const handleTabClick = (id) => {
    if (id === "apple-pay") {
      setApplePayOpen(true);
      return;
    }
    if (id === "zelle") {
      setZelleOpen(true);
      return;
    }
    if (id === "crypto") {
      setCryptoTipOpen(true);
    }
  };

  return (
    <>
      <div
        className="dda-wallet-funding-tabs"
        role="group"
        aria-label={t("pages.accounts.fundingMethodsAria")}
      >
        {FUNDING_TABS.map(({ id, labelKey, renderIcon, comingSoon }) => {
          if (comingSoon) {
            return (
              <div
                key={id}
                className={cn(
                  "dda-wallet-funding-tab-wrap",
                  cryptoTipOpen && "dda-wallet-funding-tab-wrap--tip-open",
                )}
                onMouseEnter={() => setCryptoTipOpen(true)}
                onMouseLeave={() => setCryptoTipOpen(false)}
                onFocusCapture={() => setCryptoTipOpen(true)}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setCryptoTipOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  className="dda-glass-btn dda-wallet-funding-tab dda-wallet-funding-tab--coming-soon"
                  onClick={() => handleTabClick(id)}
                  aria-describedby="wallet-funding-crypto-coming-soon"
                  aria-label={`${t(`pages.accounts.${labelKey}`)} — ${t("pages.accounts.fundingComingSoon")}`}
                >
                  {renderIcon()}
                  <span className="dda-wallet-funding-tab__label">
                    {t(`pages.accounts.${labelKey}`)}
                  </span>
                </button>
                <div
                  id="wallet-funding-crypto-coming-soon"
                  role="tooltip"
                  className="dda-wallet-funding-coming-soon"
                >
                  {t("pages.accounts.fundingComingSoon")}
                </div>
              </div>
            );
          }

          return (
            <button
              key={id}
              type="button"
              className="dda-glass-btn dda-wallet-funding-tab"
              onClick={() => handleTabClick(id)}
              aria-label={
                id === "apple-pay"
                  ? t("contribute.applePaySmsOpen")
                  : id === "zelle"
                    ? t("contribute.zellePayOpen")
                    : undefined
              }
            >
              {renderIcon()}
              <span className="dda-wallet-funding-tab__label">{t(`pages.accounts.${labelKey}`)}</span>
            </button>
          );
        })}
      </div>

      <ApplePaySmsModal open={applePayOpen} onClose={() => setApplePayOpen(false)} />
      <ZellePayModal open={zelleOpen} onClose={() => setZelleOpen(false)} />
    </>
  );
}
