import { useCallback, useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DailyAllocationsPage from "./pages/DailyAllocationsPage";
import AdminPage from "./pages/AdminPage";
import AdminDataBinsPage from "./pages/AdminDataBinsPage";
import CommunityPage from "./pages/CommunityPage";
import DashboardPage from "./pages/DashboardPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import LiquidityPoolPage from "./pages/LiquidityPoolPage";
import LoansPage from "./pages/LoansPage";
import AccountsPage from "./pages/AccountsPage";
import MembersPage from "./pages/MembersPage";
import NewPostPage from "./pages/NewPostPage";

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

function getPageFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return pages[hash] ? hash : "dashboard";
}

function hashForPage(page) {
  if (page === "dashboard") return "";
  return `/${page}`;
}

export default function App() {
  const { authEntryTick } = useDadAuth();
  const [activePage, setActivePage] = useState(() => "dashboard");
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
    if (authEntryTick) return;
    const initialPage = getPageFromHash();
    setActivePage(initialPage);
    if (window.location.hash.replace(/^#/, "") !== hashForPage(initialPage)) {
      window.location.hash = hashForPage(initialPage);
    }
  }, [authEntryTick]);

  const Page = pages[activePage] ?? DashboardPage;
  const shellPage =
    activePage === "post"
      ? "community"
      : activePage === "admin-bins"
        ? "admin"
        : activePage;

  return (
    <AppShell
      activePage={shellPage}
      scrollKey={scrollKey}
      authEntryTick={authEntryTick}
      onNavigate={navigate}
    >
      <Page key={`${activePage}-${authEntryTick}`} onNavigate={navigate} />
    </AppShell>
  );
}
