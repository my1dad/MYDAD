import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileShell from "./MobileShell";
import EasternLiveClock from "./EasternLiveClock";
import HeaderActions from "./HeaderActions";
import StockMarketSync from "../investments/StockMarketSync";
import { AppNavigateProvider } from "../../context/AppNavigateContext";

export default function AppShell({ activePage, scrollKey, authEntryTick = 0, onNavigate, children }) {
  const shellScrollKey = `${activePage}-${scrollKey}-${authEntryTick}`;

  return (
    <AppNavigateProvider value={onNavigate}>
      <div className="dda-app flex h-full min-h-0 w-full overflow-hidden">
        <StockMarketSync />
        <Sidebar activePage={activePage} onNavigate={onNavigate} />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5 lg:hidden">
            <HeaderActions onNavigate={onNavigate} />
            <EasternLiveClock />
          </div>
          <MobileShell
            variant="app"
            scrollKey={shellScrollKey}
            mainClassName="px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 lg:px-6 lg:py-4"
            contentClassName="mx-auto max-w-6xl lg:max-w-6xl"
            footer={<BottomNav activePage={activePage} onNavigate={onNavigate} />}
          >
            {children}
          </MobileShell>
        </div>
      </div>
    </AppNavigateProvider>
  );
}
