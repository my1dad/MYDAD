import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileShell from "./MobileShell";

export default function AppShell({ activePage, scrollKey, authEntryTick = 0, onNavigate, children }) {
  const shellScrollKey = `${activePage}-${scrollKey}-${authEntryTick}`;

  return (
    <div className="dda-app flex h-full min-h-0 w-full overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
  );
}
