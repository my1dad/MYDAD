/**
 * Shared nav route warming — every BottomNav / Sidebar destination uses this
 * so taps never wait on a cold network fetch.
 */

export const PAGE_LOADERS = {
  pool: () => import("../pages/LiquidityPoolPage"),
  accounts: () => import("../pages/AccountsPage"),
  members: () => import("../pages/MembersPage"),
  allocations: () => import("../pages/DailyAllocationsPage"),
  loans: () => import("../pages/LoansPage"),
  community: () => import("../pages/CommunityPage"),
  post: () => import("../pages/NewPostPage"),
  admin: () => import("../pages/AdminPage"),
  investments: () => import("../pages/InvestmentsPage"),
  "admin-bins": () => import("../pages/AdminDataBinsPage"),
};

const warmed = new Set();
const inflight = new Map();

export function prefetchPage(pageId) {
  if (!pageId || pageId === "dashboard" || warmed.has(pageId)) return;
  const loader = PAGE_LOADERS[pageId];
  if (!loader) return;
  if (inflight.has(pageId)) return inflight.get(pageId);

  const task = loader()
    .then(() => {
      warmed.add(pageId);
      inflight.delete(pageId);
    })
    .catch(() => {
      inflight.delete(pageId);
    });
  inflight.set(pageId, task);
  return task;
}

export function prefetchAllNavPages() {
  return Promise.all(Object.keys(PAGE_LOADERS).map((id) => prefetchPage(id)));
}

/** Chart widgets hydrate after the page shell — warm them so widgets appear fast too. */
export function prefetchChartWidgets() {
  return Promise.all([
    import("../components/layout/LiquidityPoolInfographic"),
    import("../components/accounts/AccountsOverviewInfographic"),
    import("../components/accounts/AccountDetailView"),
    import("../components/investments/InvestmentInfographic"),
    import("../components/investments/InvestmentYieldChart"),
    import("../components/members/MemberDetailModal"),
  ]).catch(() => {});
}
