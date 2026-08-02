import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import PlatformPreloader from "./components/layout/PlatformPreloader";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

// Eager: primary BottomNav / Sidebar destinations — instant taps, no chunk wait.
import DashboardPage from "./pages/DashboardPage";
import DailyAllocationsPage from "./pages/DailyAllocationsPage";
import MembersPage from "./pages/MembersPage";
import LiquidityPoolPage from "./pages/LiquidityPoolPage";
import AccountsPage from "./pages/AccountsPage";
import LoansPage from "./pages/LoansPage";
import CommunityPage from "./pages/CommunityPage";
import NewPostPage from "./pages/NewPostPage";
import AdminPage from "./pages/AdminPage";

// Lazy: heavy outliers only (charts / admin tooling).
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage"));
const AdminDataBinsPage = lazy(() => import("./pages/AdminDataBinsPage"));

const pages = {
  dashboard: DashboardPage,
  allocations: DailyAllocationsPage,
  members: MembersPage,
  pool: LiquidityPoolPage,
  investments: InvestmentsPage,
  accounts: AccountsPage,
  loans: LoansPage,
  community: CommunityPage,
  post: NewPostPage,
  admin: AdminPage,
  "admin-bins": AdminDataBinsPage,
};

const LAZY_PAGE_LOADERS = {
  investments: () => import("./pages/InvestmentsPage"),
  "admin-bins": () => import("./pages/AdminDataBinsPage"),
};

function getPageFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return pages[hash] ? hash : "dashboard";
}

function hashForPage(page) {
  if (page === "dashboard") return "";
  return `/${page}`;
}

/** Inline only — never fullscreen during in-app navigation (blocks BottomNav/Sidebar taps). */
function PageFallback() {
  return (
    <div className="flex min-h-[30vh] w-full items-center justify-center py-10" aria-busy="true" aria-label="Loading page">
      <PlatformPreloader fullScreen={false} kicker="Loading page" label="Loading page" />
    </div>
  );
}

export default function App() {
  const { authEntryTick, isAdmin } = useDadAuth();
  const [activePage, setActivePage] = useState(() => getPageFromHash());
  const [scrollKey, setScrollKey] = useState(0);

  useEffect(() => {
    if (!authEntryTick) return;
    setActivePage("dashboard");
    setScrollKey((tick) => tick + 1);
    if (window.location.hash.replace(/^#/, "") !== "") {
      window.location.hash = "";
    }
  }, [authEntryTick]);

  const navigate = useCallback((page) => {
    const nextPage = pages[page] ? page : "dashboard";
    setActivePage(nextPage);
    setScrollKey((tick) => tick + 1);
    const nextHash = hashForPage(nextPage);
    const currentHash = window.location.hash.replace(/^#/, "");
    if (currentHash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = getPageFromHash();
      setActivePage(nextPage);
      setScrollKey((tick) => tick + 1);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (isAdmin) return;
    if (activePage === "admin-bins" || activePage === "investments") {
      navigate("dashboard");
    }
  }, [activePage, isAdmin, navigate]);

  useEffect(() => {
    if (authEntryTick) return;
    const initialPage = getPageFromHash();
    setActivePage(initialPage);
    if (window.location.hash.replace(/^#/, "") !== hashForPage(initialPage)) {
      window.location.hash = hashForPage(initialPage);
    }
  }, [authEntryTick]);

  // Idle-prefetch heavy lazy pages after first dashboard paint.
  useEffect(() => {
    const idle = window.requestIdleCallback
      ? (cb) => window.requestIdleCallback(cb, { timeout: 3000 })
      : (cb) => window.setTimeout(cb, 200);
    const cancelIdle = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);

    const idleId = idle(() => {
      Object.values(LAZY_PAGE_LOADERS).forEach((load) => {
        void load().catch(() => {});
      });
    });
    return () => cancelIdle(idleId);
  }, []);

  const Page = pages[activePage] ?? DashboardPage;
  const shellPage =
    activePage === "post"
      ? "community"
      : activePage === "admin-bins"
        ? "admin"
        : activePage;
  const isLazyPage = activePage === "investments" || activePage === "admin-bins";

  return (
    <EasternTimeProvider>
      <AppShell
        activePage={shellPage}
        scrollKey={scrollKey}
        authEntryTick={authEntryTick}
        onNavigate={navigate}
      >
        {isLazyPage ? (
          <Suspense fallback={<PageFallback />}>
            <Page key={`${activePage}-${authEntryTick}`} onNavigate={navigate} />
          </Suspense>
        ) : (
          <Page key={`${activePage}-${authEntryTick}`} onNavigate={navigate} />
        )}
      </AppShell>
    </EasternTimeProvider>
  );
}
