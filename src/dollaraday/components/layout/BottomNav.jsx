import { useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutDollarADay } from "../../lib/logout";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import {
  getMobileNavLabel,
  getNavItemIcon,
  getNavItemLabel,
  getVisibleMobileMoreItems,
  getVisibleMobileNavItems,
} from "./Sidebar";

export default function BottomNav({ activePage, onNavigate, onPrefetch }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const visibleNavItems = getVisibleMobileNavItems(isAdmin);
  const visibleMoreItems = getVisibleMobileMoreItems(isAdmin);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const moreTriggerRef = useRef(null);
  const moreActive = visibleMoreItems.some((item) => item.id === activePage);
  const showMoreMenu = visibleMoreItems.length > 0 && moreOpen;

  const warm = (id) => {
    onPrefetch?.(id);
  };

  // Never leave the full-screen More backdrop up after nav / role changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [activePage, isAdmin, visibleMoreItems.length]);

  useEffect(() => {
    if (!showMoreMenu) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreMenuRef.current?.contains(target)) return;
      if (moreTriggerRef.current?.contains(target)) return;
      setMoreOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMoreMenu]);

  return (
    <>
      {showMoreMenu ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 touch-manipulation lg:hidden"
          aria-label={t("nav.more")}
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      <nav className="relative z-50 shrink-0 border-t border-white/10 bg-dda-bg/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around text-xs text-gray-300">
          {visibleNavItems.map(({ id, icon: Icon }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                type="button"
                onPointerDown={() => warm(id)}
                onClick={() => onNavigate(id)}
                className={cn(
                  "dda-bottom-nav__item flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 touch-manipulation",
                  active && "dda-bottom-nav__item--active",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span>{getMobileNavLabel(id, t, isAdmin)}</span>
              </button>
            );
          })}

          {visibleMoreItems.length ? (
            <div className="relative" ref={moreTriggerRef}>
              <button
                type="button"
                aria-expanded={showMoreMenu}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((open) => !open)}
                className={cn(
                  "dda-bottom-nav__item flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 touch-manipulation",
                  (showMoreMenu || moreActive) && "dda-bottom-nav__item--active",
                )}
              >
                <MoreHorizontal
                  className="h-5 w-5"
                  strokeWidth={showMoreMenu || moreActive ? 2.5 : 2}
                />
                <span>{t("nav.more")}</span>
              </button>

              {showMoreMenu ? (
                <div
                  ref={moreMenuRef}
                  role="menu"
                  className="absolute bottom-full right-0 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-dda-bg py-1 shadow-xl"
                >
                  {visibleMoreItems.map(({ id, icon: DefaultIcon }) => {
                    const Icon = getNavItemIcon(id, DefaultIcon, isAdmin);
                    return (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        onPointerDown={() => warm(id)}
                        onClick={() => {
                          onNavigate(id);
                          setMoreOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2.5 text-sm",
                          activePage === id
                            ? "dda-nav-active"
                            : "text-gray-300 hover:bg-white/5",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {getNavItemLabel(id, t, isAdmin)}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    role="menuitem"
                    onPointerDown={() => warm("profile")}
                    onClick={() => {
                      onNavigate("profile");
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-sm",
                      activePage === "profile"
                        ? "dda-nav-active"
                        : "text-gray-300 hover:bg-white/5",
                    )}
                  >
                    <UserRound className="h-4 w-4" />
                    {t("nav.profile")}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      logoutDollarADay();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-400/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("nav.logout")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </nav>
    </>
  );
}
