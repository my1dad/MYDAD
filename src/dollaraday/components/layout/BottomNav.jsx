import { useEffect, useRef, useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutDollarADay } from "../../lib/logout";
import { useLocale } from "../../i18n/LocaleContext";
import { mobileMoreItems, mobileNavItems, getMobileNavLabel } from "./Sidebar";

export default function BottomNav({ activePage, onNavigate }) {
  const { t } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const moreTriggerRef = useRef(null);
  const moreActive = mobileMoreItems.some((item) => item.id === activePage);

  useEffect(() => {
    if (!moreOpen) return;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreMenuRef.current?.contains(target)) return;
      if (moreTriggerRef.current?.contains(target)) return;
      setMoreOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 touch-manipulation lg:hidden"
          aria-hidden="true"
        />
      )}

      <nav className="relative z-50 shrink-0 border-t border-white/10 bg-dda-bg/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around text-xs text-gray-300">
          {mobileNavItems.map(({ id, icon: Icon }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate(id)}
                className={cn(
                  "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 touch-manipulation",
                  active ? "text-dda-green-light" : "hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span>{getMobileNavLabel(id, t)}</span>
              </button>
            );
          })}

          <div className="relative" ref={moreTriggerRef}>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 touch-manipulation",
                moreOpen || moreActive ? "text-dda-green-light" : "hover:text-white"
              )}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={moreOpen || moreActive ? 2.5 : 2} />
              <span>{t("nav.more")}</span>
            </button>

            {moreOpen && (
              <div
                ref={moreMenuRef}
                role="menu"
                className="absolute bottom-full right-0 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-dda-bg py-1 shadow-xl"
              >
                {mobileMoreItems.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onNavigate(id);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-sm",
                      activePage === id
                        ? "dda-nav-active"
                        : "text-gray-300 hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(`nav.${id}`)}
                  </button>
                ))}
                <div className="my-1 border-t border-white/10" />
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
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
