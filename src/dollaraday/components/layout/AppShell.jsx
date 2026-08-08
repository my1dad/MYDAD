import { lazy, Suspense } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileShell from "./MobileShell";
import HeaderActions from "./HeaderActions";
import { AppNavigateProvider } from "../../context/AppNavigateContext";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { cn } from "@/lib/utils";

const StockMarketSync = lazy(() => import("../investments/StockMarketSync"));

/** Stock quotes only on investments — keeps dashboard first paint light. */
const STOCK_SYNC_PAGES = new Set(["investments"]);

export default function AppShell({
  activePage,
  scrollKey,
  authEntryTick = 0,
  onNavigate,
  onPrefetch,
  children,
}) {
  const { isAdmin } = useDadAuth();
  const shellScrollKey = `${activePage}-${scrollKey}-${authEntryTick}`;

  return (
    <AppNavigateProvider value={onNavigate}>
      <div
        className={cn(
          "dda-app flex h-full min-h-0 w-full overflow-hidden",
          isAdmin && "dda-app--admin",
        )}
      >
        {STOCK_SYNC_PAGES.has(activePage) ? (
          <Suspense fallback={null}>
            <StockMarketSync />
          </Suspense>
        ) : null}
        <Sidebar activePage={activePage} onNavigate={onNavigate} onPrefetch={onPrefetch} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="dda-mobile-topbar flex w-full shrink-0 items-center border-b border-white/10 px-3 lg:hidden">
            <HeaderActions onNavigate={onNavigate} className="dda-header-actions--bar" />
          </div>
          <MobileShell
            variant="app"
            scrollKey={shellScrollKey}
            mainClassName="px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:px-6 lg:py-4"
            contentClassName="mx-auto max-w-6xl lg:max-w-7xl"
            footer={
              <BottomNav activePage={activePage} onNavigate={onNavigate} onPrefetch={onPrefetch} />
            }
          >
            {children}
          </MobileShell>
        </div>
      </div>
    </AppNavigateProvider>
  );
}
