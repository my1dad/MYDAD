import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

/**
 * Primary nav pages are sync — once App is downloaded, taps switch instantly.
 * Rare/admin tooling stays lazy. Charts stay lazy inside pages.
 */
import DashboardPage from "./pages/DashboardPage";
import LiquidityPoolPage from "./pages/LiquidityPoolPage";
import AccountsPage from "./pages/AccountsPage";
import MembersPage from "./pages/MembersPage";
import DailyAllocationsPage from "./pages/DailyAllocationsPage";
import LoansPage from "./pages/LoansPage";
import CommunityPage from "./pages/CommunityPage";
import AdminPage from "./pages/AdminPage";
import InvestmentsPage from "./pages/InvestmentsPage";

const AdminDataBinsPage = lazy(() => import("./pages/AdminDataBinsPage"));

const pages = {
  dashboard: DashboardPage,
  pool: LiquidityPoolPage,
  accounts: AccountsPage,
  members: MembersPage,
  allocations: DailyAllocationsPage,
  loans: LoansPage,
  community: CommunityPage,
  admin: AdminPage,
  investments: InvestmentsPage,
  "admin-bins": AdminDataBinsPage,
};

function getPageFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return pages[hash] ? hash : "dashboard";
}

function hashForPage(page) {
  if (page === "dashboard") return "";
  return `/${page}`;
}

function shellPageId(page) {
  if (page === "admin-bins") return "admin";
  return page;
}

export default function App() {
  const { authEntryTick, isAdmin } = useDadAuth();
  const [activePage, setActivePage] = useState(() => getPageFromHash());
  const [scrollKey, setScrollKey] = useState(0);

  const goTo = useCallback((page) => {
    const nextPage = pages[page] ? page : "dashboard";
    setActivePage(nextPage);
    setScrollKey((tick) => tick + 1);
    const nextHash = hashForPage(nextPage);
    if (window.location.hash.replace(/^#/, "") !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  useEffect(() => {
    if (!authEntryTick) return;
    setActivePage("dashboard");
    setScrollKey((tick) => tick + 1);
    if (window.location.hash.replace(/^#/, "") !== "") {
      window.location.hash = "";
    }
  }, [authEntryTick]);

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
      goTo("dashboard");
    }
  }, [activePage, isAdmin, goTo]);

  useEffect(() => {
    if (authEntryTick) return;
    const initialPage = getPageFromHash();
    setActivePage(initialPage);
    if (window.location.hash.replace(/^#/, "") !== hashForPage(initialPage)) {
      window.location.hash = hashForPage(initialPage);
    }
  }, [authEntryTick]);

  const Page = pages[activePage] ?? DashboardPage;
  const isLazyAdminBins = activePage === "admin-bins";

  return (
    <EasternTimeProvider>
      <AppShell
        activePage={shellPageId(activePage)}
        scrollKey={scrollKey}
        authEntryTick={authEntryTick}
        onNavigate={goTo}
      >
        {isLazyAdminBins ? (
          <Suspense fallback={null}>
            <Page key={`${activePage}-${authEntryTick}`} onNavigate={goTo} />
          </Suspense>
        ) : (
          <Page key={`${activePage}-${authEntryTick}`} onNavigate={goTo} />
        )}
      </AppShell>
    </EasternTimeProvider>
  );
}
