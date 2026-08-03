import { useEffect, useRef, useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { logoutDollarADay } from "../../lib/logout";

export default function ProfileHeaderButton({ onNavigate, className }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (isAdmin) {
    return (
      <button
        type="button"
        onClick={() => onNavigate?.("profile")}
        className={cn("dda-profile-header-btn", className)}
        aria-label={t("nav.profile")}
        title={t("nav.profile")}
      >
        <UserRound className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
      </button>
    );
  }

  return (
    <div ref={rootRef} className={cn("dda-profile-header-menu", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="dda-profile-header-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("nav.profile")}
        title={t("nav.profile")}
      >
        <UserRound className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
      </button>

      {open ? (
        <div role="menu" className="dda-profile-header-menu__panel">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.("profile");
            }}
            className="dda-profile-header-menu__item"
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            {t("nav.profile")}
          </button>
          <div className="dda-profile-header-menu__divider" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logoutDollarADay();
            }}
            className="dda-profile-header-menu__item dda-profile-header-menu__item--danger"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("nav.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
