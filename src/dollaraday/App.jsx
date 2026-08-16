import { lazy, Suspense, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import AppShell from "./components/layout/AppShell";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

/** Home is sync — everything else loads on demand so nav never downloads the world. */
import DashboardPage from "./pages/DashboardPage";

const pageLoaders = {
  pool: () => import("./pages/LiquidityPoolPage"),
  accounts: () => import("./pages/AccountsPage"),
  members: () => import("./pages/MembersPage"),
  allocations: () => import("./pages/DailyAllocationsPage"),
  loans: () => import("./pages/LoansPage"),
  community: () => import("./pages/CommunityPage"),
  admin: () => import("./pages/AdminPage"),
  profile: () => import("./pages/ProfilePage"),
  investments: () => import("./pages/InvestmentsPage"),
  "admin-bins": () => import("./pages/AdminDataBinsPage"),
};

const LiquidityPoolPage = lazy(pageLoaders.pool);
const AccountsPage = lazy(pageLoaders.accounts);
const MembersPage = lazy(pageLoaders.members);
const DailyAllocationsPage = lazy(pageLoaders.allocations);
const LoansPage = lazy(pageLoaders.loans);
const CommunityPage = lazy(pageLoaders.community);
const AdminPage = lazy(pageLoaders.admin);
const ProfilePage = lazy(pageLoaders.profile);
const InvestmentsPage = lazy(pageLoaders.investments);
const AdminDataBinsPage = lazy(pageLoaders["admin-bins"]);

const pages = {
  dashboard: DashboardPage,
  pool: LiquidityPoolPage,
  accounts: AccountsPage,
  members: MembersPage,
  allocations: DailyAllocationsPage,
  loans: LoansPage,
  community: CommunityPage,
  admin: AdminPage,
  profile: ProfilePage,
  investments: InvestmentsPage,
  "admin-bins": AdminDataBinsPage,
};

const warmed = new Set(["dashboard"]);

export function prefetchPage(pageId) {
  const loader = pageLoaders[pageId];
  if (!loader || warmed.has(pageId)) return;
  warmed.add(pageId);
  void loader();
}

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
  const navigatingRef = useRef(false);

  const goTo = useCallback((page) => {
    const nextPage = pages[page] ? page : "dashboard";
    prefetchPage(nextPage);
    navigatingRef.current = true;
    startTransition(() => {
      setActivePage(nextPage);
      setScrollKey((tick) => tick + 1);
    });
    const nextHash = hashForPage(nextPage);
    if (window.location.hash.replace(/^#/, "") !== nextHash) {
      window.location.hash = nextHash;
    }
    // Allow hashchange echo to be ignored briefly.
    window.setTimeout(() => {
      navigatingRef.current = false;
    }, 50);
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
      if (navigatingRef.current) return;
      const nextPage = getPageFromHash();
      prefetchPage(nextPage);
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
    // Members use member pages only — never the master admin workspace.
    if (
      activePage === "admin" ||
      activePage === "admin-bins" ||
      activePage === "investments" ||
      activePage === "allocations"
    ) {
      goTo(activePage === "admin" ? "profile" : "dashboard");
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

  // Warm primary destinations only on first intentional nav press (see onPrefetch).
  // Idle prefetch of every page competed with first interactions.
  const Page = pages[activePage] ?? DashboardPage;
  const isDashboard = activePage === "dashboard";

  return (
    <EasternTimeProvider>
      <AppShell
        activePage={shellPageId(activePage)}
        scrollKey={scrollKey}
        authEntryTick={authEntryTick}
        onNavigate={goTo}
        onPrefetch={prefetchPage}
      >
        {isDashboard ? (
          <Page key={`${activePage}-${authEntryTick}`} onNavigate={goTo} />
        ) : (
          <Suspense fallback={null}>
            <Page key={`${activePage}-${authEntryTick}`} onNavigate={goTo} />
          </Suspense>
        )}
      </AppShell>
      <Analytics />
    </EasternTimeProvider>
  );
}
