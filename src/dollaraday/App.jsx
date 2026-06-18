import { useCallback, useEffect, useState } from "react";
import AppShell from "./components/layout/AppShell";
import DailyAllocationsPage from "./pages/DailyAllocationsPage";
import AdminPage from "./pages/AdminPage";
import AdminDataBinsPage from "./pages/AdminDataBinsPage";
import CommunityPage from "./pages/CommunityPage";
import DashboardPage from "./pages/DashboardPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import LiquidityPoolPage from "./pages/LiquidityPoolPage";
import LoansPage from "./pages/LoansPage";
import MembersPage from "./pages/MembersPage";
import NewPostPage from "./pages/NewPostPage";

const pages = {
  dashboard: DashboardPage,
  allocations: DailyAllocationsPage,
  members: MembersPage,
  pool: LiquidityPoolPage,
  investments: InvestmentsPage,
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
  const [activePage, setActivePage] = useState(getPageFromHash);

  const navigate = useCallback((page) => {
    const nextPage = pages[page] ? page : "dashboard";
    setActivePage(nextPage);
    const nextHash = hashForPage(nextPage);
    const currentHash = window.location.hash.replace(/^#/, "");
    if (currentHash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const initialPage = getPageFromHash();
    if (window.location.hash.replace(/^#/, "") !== hashForPage(initialPage)) {
      window.location.hash = hashForPage(initialPage);
    }
  }, []);

  const Page = pages[activePage] ?? DashboardPage;
  const shellPage =
    activePage === "post"
      ? "community"
      : activePage === "admin-bins"
        ? "admin"
        : activePage;

  return (
    <AppShell activePage={shellPage} onNavigate={navigate}>
      <Page onNavigate={navigate} />
    </AppShell>
  );
}
