import { lazy, Suspense } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileShell from "./MobileShell";
import HeaderActions from "./HeaderActions";
import { AppNavigateProvider } from "../../context/AppNavigateContext";

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
  const shellScrollKey = `${activePage}-${scrollKey}-${authEntryTick}`;

  return (
    <AppNavigateProvider value={onNavigate}>
      <div className="dda-app flex h-full min-h-0 w-full overflow-hidden">
        {STOCK_SYNC_PAGES.has(activePage) ? (
          <Suspense fallback={null}>
            <StockMarketSync />
          </Suspense>
        ) : null}
        <Sidebar activePage={activePage} onNavigate={onNavigate} onPrefetch={onPrefetch} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center border-b border-white/10 px-3 py-1.5 lg:hidden">
            <HeaderActions onNavigate={onNavigate} />
          </div>
          <MobileShell
            variant="app"
            scrollKey={shellScrollKey}
            mainClassName="px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:px-6 lg:py-4"
            contentClassName="mx-auto max-w-6xl lg:max-w-6xl"
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
