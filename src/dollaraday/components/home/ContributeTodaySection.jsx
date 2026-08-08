import { useState } from "react";
import { APPLE_PAY_LOGO_URL, ZELLE_LOGO_URL } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";
import ApplePaySmsModal from "./ApplePaySmsModal.jsx";
import ZellePayModal from "./ZellePayModal.jsx";

function PaymentMethods({ hideLabel = false }) {
  const { t } = useLocale();
  const [applePayOpen, setApplePayOpen] = useState(false);
  const [zelleOpen, setZelleOpen] = useState(false);

  return (
    <>
      <div className="dda-contribute-panel__payments" aria-label={t("pages.dashboard.paymentMethods")}>
        <div className="dda-home-payment-logos dda-home-payment-logos--inline">
          <button
            type="button"
            className="dda-home-payment-logo-link"
            aria-label={t("contribute.applePaySmsOpen")}
            onClick={() => setApplePayOpen(true)}
          >
            <img
              src={APPLE_PAY_LOGO_URL}
              alt=""
              className="dda-home-payment-logo dda-home-payment-logo--apple"
              draggable={false}
            />
          </button>
          {hideLabel ? null : (
            <span className="dda-contribute-panel__pay-label">{t("pages.dashboard.payWith")}</span>
          )}
          <button
            type="button"
            className="dda-home-payment-logo-link"
            aria-label={t("contribute.zellePayOpen")}
            onClick={() => setZelleOpen(true)}
          >
            <img
              src={ZELLE_LOGO_URL}
              alt=""
              className="dda-home-payment-logo dda-home-payment-logo--zelle"
              draggable={false}
            />
          </button>
        </div>
      </div>

      <ApplePaySmsModal open={applePayOpen} onClose={() => setApplePayOpen(false)} />
      <ZellePayModal open={zelleOpen} onClose={() => setZelleOpen(false)} />
    </>
  );
}

/** Home contribute rail — Apple Pay + Zelle only (membership amount presets removed). */
export default function ContributeTodaySection({ className, bare = false }) {
  const { t } = useLocale();

  if (bare) {
    return (
      <div className={cn("dda-contribute-section dda-contribute-section--bare", className)}>
        <PaymentMethods hideLabel />
      </div>
    );
  }

  return (
    <section
      className={cn("dda-contribute-section", className)}
      aria-label={t("pages.dashboard.paymentMethods")}
    >
      <PaymentMethods />
    </section>
  );
}
