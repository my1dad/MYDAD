import { lazy, Suspense, startTransition, useCallback, useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";
import { prefetchAllNavPages, prefetchChartWidgets, prefetchPage } from "./lib/navPrefetch";

/** Home only — never block first paint on recharts. */
import DashboardPage from "./pages/DashboardPage";

const LiquidityPoolPage = lazy(() => import("./pages/LiquidityPoolPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const DailyAllocationsPage = lazy(() => import("./pages/DailyAllocationsPage"));
const LoansPage = lazy(() => import("./pages/LoansPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const NewPostPage = lazy(() => import("./pages/NewPostPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage"));
const AdminDataBinsPage = lazy(() => import("./pages/AdminDataBinsPage"));

const PAGE_COMPONENTS = {
  dashboard: DashboardPage,
  pool: LiquidityPoolPage,
  accounts: AccountsPage,
  members: MembersPage,
  allocations: DailyAllocationsPage,
  loans: LoansPage,
  community: CommunityPage,
  post: NewPostPage,
  admin: AdminPage,
  investments: InvestmentsPage,
  "admin-bins": AdminDataBinsPage,
};

function getPageFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return PAGE_COMPONENTS[hash] ? hash : "dashboard";
}

function hashForPage(page) {
  if (page === "dashboard") return "";
  return `/${page}`;
}

function shellPageId(page) {
  if (page === "post") return "community";
  if (page === "admin-bins") return "admin";
  return page;
}

/** Tiny placeholder — only if a chunk somehow isn't warm yet (should be rare). */
function PageSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-44 animate-pulse rounded-lg bg-white/10" />
      <div className="h-36 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

export default function App() {
  const { authEntryTick, isAdmin } = useDadAuth();
  const [activePage, setActivePage] = useState(() => getPageFromHash());
  const [scrollKey, setScrollKey] = useState(0);
  const [mountedPages, setMountedPages] = useState(() => ({
    dashboard: true,
    [getPageFromHash()]: true,
  }));

  const goTo = useCallback((page) => {
    const nextPage = PAGE_COMPONENTS[page] ? page : "dashboard";
    prefetchPage(nextPage);
    setMountedPages((prev) => (prev[nextPage] ? prev : { ...prev, [nextPage]: true }));
    startTransition(() => {
      setActivePage(nextPage);
      setScrollKey((tick) => tick + 1);
    });
    const nextHash = hashForPage(nextPage);
    if (window.location.hash.replace(/^#/, "") !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  useEffect(() => {
    if (!authEntryTick) return;
    setMountedPages((prev) => ({ ...prev, dashboard: true }));
    startTransition(() => {
      setActivePage("dashboard");
      setScrollKey((tick) => tick + 1);
    });
    if (window.location.hash.replace(/^#/, "") !== "") {
      window.location.hash = "";
    }
  }, [authEntryTick]);

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = getPageFromHash();
      prefetchPage(nextPage);
      setMountedPages((prev) => (prev[nextPage] ? prev : { ...prev, [nextPage]: true }));
      startTransition(() => {
        setActivePage(nextPage);
        setScrollKey((tick) => tick + 1);
      });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (isAdmin) return;
    if (activePage === "admin-bins" || activePage === "investments") {
      goTo("dashboard");
    }
  }, [activePage, isAdmin, goTo]);

  useEffect(() => {
    if (authEntryTick) return;
    const initialPage = getPageFromHash();
    setMountedPages((prev) => ({ ...prev, [initialPage]: true }));
    if (window.location.hash.replace(/^#/, "") !== hashForPage(initialPage)) {
      window.location.hash = hashForPage(initialPage);
    }
  }, [authEntryTick]);

  // Warm EVERY nav destination equally, then mount them hidden so first tap is cached.
  useEffect(() => {
    let alive = true;
    void prefetchAllNavPages().then(() => {
      if (!alive) return;
      setMountedPages((prev) => {
        const next = { ...prev };
        Object.keys(PAGE_COMPONENTS).forEach((id) => {
          next[id] = true;
        });
        return next;
      });
    });
    const chartId = window.setTimeout(() => {
      void prefetchChartWidgets();
    }, 800);
    return () => {
      alive = false;
      window.clearTimeout(chartId);
    };
  }, []);

  return (
    <EasternTimeProvider>
      <AppShell
        activePage={shellPageId(activePage)}
        scrollKey={scrollKey}
        authEntryTick={authEntryTick}
        onNavigate={goTo}
        onPrefetch={prefetchPage}
      >
        {Object.entries(PAGE_COMPONENTS).map(([id, Page]) => {
          if (!mountedPages[id]) return null;
          const active = activePage === id;
          return (
            <div
              key={id}
              style={{ display: active ? "contents" : "none" }}
              aria-hidden={!active}
            >
              <Suspense fallback={active ? <PageSkeleton /> : null}>
                <Page onNavigate={goTo} />
              </Suspense>
            </div>
          );
        })}
      </AppShell>
    </EasternTimeProvider>
  );
}
