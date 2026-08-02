import { lazy, Suspense, startTransition, useCallback, useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

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

const PAGE_LOADERS = {
  pool: () => import("./pages/LiquidityPoolPage"),
  accounts: () => import("./pages/AccountsPage"),
  members: () => import("./pages/MembersPage"),
  allocations: () => import("./pages/DailyAllocationsPage"),
  loans: () => import("./pages/LoansPage"),
  community: () => import("./pages/CommunityPage"),
  post: () => import("./pages/NewPostPage"),
  admin: () => import("./pages/AdminPage"),
  investments: () => import("./pages/InvestmentsPage"),
  "admin-bins": () => import("./pages/AdminDataBinsPage"),
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

export default function App() {
  const { authEntryTick, isAdmin } = useDadAuth();
  const [activePage, setActivePage] = useState(() => getPageFromHash());
  const [scrollKey, setScrollKey] = useState(0);
  const [mountedPages, setMountedPages] = useState(() => ({
    dashboard: true,
    [getPageFromHash()]: true,
  }));

  /** Instant switch — page body paints immediately; charts hydrate inside the page. */
  const goTo = useCallback((page) => {
    const nextPage = PAGE_COMPONENTS[page] ? page : "dashboard";
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

  // Prefetch only light routes (no recharts). Chart pages load on tap.
  useEffect(() => {
    const light = ["allocations", "loans", "community", "post", "admin", "admin-bins", "members"];
    void Promise.all(light.map((id) => PAGE_LOADERS[id]().catch(() => {})));
  }, []);

  return (
    <EasternTimeProvider>
      <AppShell
        activePage={shellPageId(activePage)}
        scrollKey={scrollKey}
        authEntryTick={authEntryTick}
        onNavigate={goTo}
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
              <Suspense fallback={null}>
                <Page onNavigate={goTo} />
              </Suspense>
            </div>
          );
        })}
      </AppShell>
    </EasternTimeProvider>
  );
}
