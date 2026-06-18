import { useEffect, useState } from "react";
import { LogOut, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutDollarADay } from "../../lib/logout";
import { useLocale } from "../../i18n/LocaleContext";
import { mobileMoreItems, mobileNavItems, getMobileNavLabel } from "./Sidebar";
import LanguageToggle from "./LanguageToggle";

export default function BottomNav({ activePage, onNavigate }) {
  const { t } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileMoreItems.some((item) => item.id === activePage);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = () => setMoreOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [moreOpen]);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 touch-manipulation lg:hidden"
          onMouseDown={() => setMoreOpen(false)}
          onTouchStart={() => setMoreOpen(false)}
        />
      )}

      <nav className="z-40 shrink-0 border-t border-white/10 bg-[#071013]/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
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
                  active ? "text-emerald-400" : "hover:text-white"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span>{getMobileNavLabel(id, t)}</span>
              </button>
            );
          })}

          <div className="relative">
            <button
              type="button"
              aria-expanded={moreOpen}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 touch-manipulation",
                moreOpen || moreActive ? "text-emerald-400" : "hover:text-white"
              )}
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={moreOpen || moreActive ? 2.5 : 2} />
              <span>{t("nav.more")}</span>
            </button>

            {moreOpen && (
              <div
                className="absolute bottom-full right-0 z-50 mb-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#071013] py-1 shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex justify-end px-2 py-1.5">
                  <LanguageToggle />
                </div>
                <div className="my-1 border-t border-white/10" />
                {mobileMoreItems.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onNavigate(id);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-sm",
                      activePage === id
                        ? "bg-emerald-400/10 text-emerald-400"
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
