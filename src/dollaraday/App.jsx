import { lazy, Suspense, startTransition, useCallback, useEffect, useRef, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

/** Only home is sync — post-login paint stays light (no recharts in the critical path). */
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

const PAGE_LOADERS = {
  dashboard: () => Promise.resolve({ default: DashboardPage }),
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

export default function App() {
  const { authEntryTick, isAdmin } = useDadAuth();
  const [activePage, setActivePage] = useState(() => getPageFromHash());
  const [scrollKey, setScrollKey] = useState(0);
  const [mountedPages, setMountedPages] = useState(() => ({
    dashboard: true,
    [getPageFromHash()]: true,
  }));
  const navSeq = useRef(0);

  const applyPage = useCallback((nextPage) => {
    setMountedPages((prev) => (prev[nextPage] ? prev : { ...prev, [nextPage]: true }));
    startTransition(() => {
      setActivePage(nextPage);
      setScrollKey((tick) => tick + 1);
    });
    const nextHash = hashForPage(nextPage);
    const currentHash = window.location.hash.replace(/^#/, "");
    if (currentHash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  /** Wait for the chunk, keep current page on screen — never show a loading spinner. */
  const goTo = useCallback(
    (page) => {
      const nextPage = PAGE_COMPONENTS[page] ? page : "dashboard";
      if (nextPage === activePage) return;

      const seq = ++navSeq.current;
      const loader = PAGE_LOADERS[nextPage] ?? PAGE_LOADERS.dashboard;

      void loader()
        .then(() => {
          if (seq !== navSeq.current) return;
          applyPage(nextPage);
        })
        .catch(() => {
          if (seq !== navSeq.current) return;
          applyPage(nextPage);
        });
    },
    [activePage, applyPage],
  );

  useEffect(() => {
    if (!authEntryTick) return;
    applyPage("dashboard");
  }, [authEntryTick, applyPage]);

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = getPageFromHash();
      if (nextPage === activePage) return;
      const seq = ++navSeq.current;
      const loader = PAGE_LOADERS[nextPage] ?? PAGE_LOADERS.dashboard;
      void loader().then(() => {
        if (seq !== navSeq.current) return;
        setMountedPages((prev) => (prev[nextPage] ? prev : { ...prev, [nextPage]: true }));
        startTransition(() => {
          setActivePage(nextPage);
          setScrollKey((tick) => tick + 1);
        });
      });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [activePage]);

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

  // Warm light routes immediately; chart-heavy routes shortly after so home stays snappy.
  useEffect(() => {
    const light = ["allocations", "loans", "community", "post", "admin", "admin-bins"];
    const heavy = ["pool", "accounts", "members", "investments"];
    void Promise.all(light.map((id) => PAGE_LOADERS[id]().catch(() => {})));
    const heavyId = window.setTimeout(() => {
      void Promise.all(heavy.map((id) => PAGE_LOADERS[id]().catch(() => {})));
    }, 1200);
    return () => window.clearTimeout(heavyId);
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
