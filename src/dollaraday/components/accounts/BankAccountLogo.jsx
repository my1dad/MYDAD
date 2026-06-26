import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { getAccountLogoMeta } from "./accountDisplay";

export default function BankAccountLogo({ accountId, className, size = "md" }) {
  const { isAdmin } = useDadAuth();
  const logoMeta = getAccountLogoMeta(accountId, isAdmin);
  if (!logoMeta) return null;

  if (logoMeta.isBrandLogo) {
    return (
      <span
        className={cn(
          "dda-nav-icon dda-bank-logo-wrap overflow-hidden",
          size === "sm" && "h-8 w-8",
          size === "lg" && "h-11 w-11",
          size === "md" && "h-9 w-9",
          className,
        )}
      >
        <img
          src={logoMeta.logoSrc}
          alt={logoMeta.logoAlt}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          decoding="async"
        />
      </span>
    );
  }

  return (
    <img
      src={logoMeta.logoSrc}
      alt={logoMeta.logoAlt}
      className={cn(
        "dda-bank-logo dda-bank-logo--icon",
        size === "sm" && "dda-bank-logo--sm",
        size === "lg" && "dda-bank-logo--lg",
        className,
      )}
      loading="lazy"
      decoding="async"
    />
  );
}
