import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

export default function AppShell({ activePage, onNavigate, children }) {
  return (
    <div className="dda-app flex min-h-dvh">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <main className="dda-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 pb-24 sm:px-4 lg:px-6 lg:pb-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <BottomNav activePage={activePage} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
