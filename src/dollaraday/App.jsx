import { lazy, Suspense, useCallback, useEffect, useState, useTransition } from "react";
import AppShell from "./components/layout/AppShell";
import PlatformPreloader from "./components/layout/PlatformPreloader";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DailyAllocationsPage = lazy(() => import("./pages/DailyAllocationsPage"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const LiquidityPoolPage = lazy(() => import("./pages/LiquidityPoolPage"));
const InvestmentsPage = lazy(() => import("./pages/InvestmentsPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const LoansPage = lazy(() => import("./pages/LoansPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const NewPostPage = lazy(() => import("./pages/NewPostPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
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

function getPageFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return pages[hash] ? hash : "dashboard";
}

function hashForPage(page) {
  if (page === "dashboard") return "";
  return `/${page}`;
}

function PageFallback() {
  return <PlatformPreloader fullScreen={false} kicker="Loading page" label="Loading page" />;
}

export default function App() {
  const { authEntryTick, isAdmin } = useDadAuth();
  const [activePage, setActivePage] = useState(() => "dashboard");
  const [scrollKey, setScrollKey] = useState(0);
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    const onHashChange = () => {
      const nextPage = getPageFromHash();
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

  const Page = pages[activePage] ?? DashboardPage;
  const shellPage =
    activePage === "post"
      ? "community"
      : activePage === "admin-bins"
        ? "admin"
        : activePage;

  return (
    <EasternTimeProvider>
      <AppShell
        activePage={shellPage}
        scrollKey={scrollKey}
        authEntryTick={authEntryTick}
        onNavigate={navigate}
      >
        {isPending ? <PlatformPreloader fullScreen kicker="Loading page" label="Loading page" /> : null}
        <Suspense fallback={<PageFallback />}>
          <Page key={`${activePage}-${authEntryTick}`} onNavigate={navigate} />
        </Suspense>
      </AppShell>
    </EasternTimeProvider>
  );
}
