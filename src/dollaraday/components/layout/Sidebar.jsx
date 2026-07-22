import {
  Banknote,
  CalendarClock,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PiggyBank,
  Shield,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { logoutDollarADay } from "../../lib/logout";
import EasternLiveClock from "./EasternLiveClock";
import HeaderActions from "./HeaderActions";

const navItemById = {
  dashboard: { id: "dashboard", icon: LayoutDashboard },
  allocations: { id: "allocations", icon: CalendarClock },
  members: { id: "members", icon: Users },
  pool: { id: "pool", icon: PiggyBank },
  investments: { id: "investments", icon: TrendingUp },
  accounts: { id: "accounts", icon: Wallet },
  community: { id: "community", icon: MessageSquare },
  admin: { id: "admin", icon: Shield },
  loans: { id: "loans", icon: Banknote },
};

export const navItems = [
  navItemById.dashboard,
  navItemById.allocations,
  navItemById.members,
  navItemById.pool,
  navItemById.investments,
  navItemById.accounts,
  navItemById.community,
  navItemById.admin,
];

export const mobileNavItems = [
  navItemById.dashboard,
  navItemById.pool,
  navItemById.investments,
  navItemById.accounts,
];

export const mobileMoreItems = [
  navItemById.allocations,
  navItemById.members,
  navItemById.loans,
  navItemById.community,
  navItemById.admin,
];

const ADMIN_NAV_IDS = ["dashboard", "allocations", "members", "pool", "investments", "accounts", "community", "admin"];
const MEMBER_NAV_IDS = ["dashboard", "allocations", "members", "pool", "accounts", "community", "admin"];
const ADMIN_MOBILE_NAV_IDS = ["dashboard", "pool", "investments", "accounts"];
const MEMBER_MOBILE_NAV_IDS = ["dashboard", "pool", "accounts", "community"];
const ADMIN_MOBILE_MORE_IDS = ["allocations", "members", "loans", "community", "admin"];
const MEMBER_MOBILE_MORE_IDS = ["allocations", "members", "loans", "admin"];

const mobileNavLabels = {
  dashboard: "home",
  investments: "invest",
};

export function getVisibleNavItems(isAdmin) {
  const ids = isAdmin ? ADMIN_NAV_IDS : MEMBER_NAV_IDS;
  return ids.map((id) => navItemById[id]).filter(Boolean);
}

export function getVisibleMobileNavItems(isAdmin) {
  const ids = isAdmin ? ADMIN_MOBILE_NAV_IDS : MEMBER_MOBILE_NAV_IDS;
  return ids.map((id) => navItemById[id]).filter(Boolean);
}

export function getVisibleMobileMoreItems(isAdmin) {
  const ids = isAdmin ? ADMIN_MOBILE_MORE_IDS : MEMBER_MOBILE_MORE_IDS;
  return ids.map((id) => navItemById[id]).filter(Boolean);
}

export default function Sidebar({ activePage, onNavigate }) {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const visibleNavItems = getVisibleNavItems(isAdmin);

  return (
    <aside className="dda-scroll hidden h-full min-h-0 w-56 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-dda-bg px-3 py-4 lg:flex">
      <div className="mb-6 px-2">
        <div className="flex items-center gap-2.5">
          <div className="dda-nav-icon">
            <CircleDollarSign className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{t("brand.name")}</p>
            <p className="text-[10px] text-gray-500">{t("brand.tagline")}</p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {visibleNavItems.map(({ id, icon: DefaultIcon }) => {
          const active = activePage === id;
          const Icon = getNavItemIcon(id, DefaultIcon, isAdmin);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                active ? "dda-nav-active" : "text-gray-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.25 : 2} />
              {getNavItemLabel(id, t, isAdmin)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => logoutDollarADay()}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-400/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
          {t("nav.logout")}
        </button>
      </nav>

      <div className="mt-auto border-t border-white/10 px-2 pt-3">
        <div className="flex items-start justify-between gap-2">
          <HeaderActions onNavigate={onNavigate} />
          <EasternLiveClock variant="sidebar" className="min-w-0 flex-1 text-right" />
        </div>
      </div>
    </aside>
  );
}

export function getNavItemLabel(id, t, isAdmin) {
  if (id === "admin" && !isAdmin) return t("nav.settings");
  if (id === "accounts" && !isAdmin) return t("nav.wallet");
  const key = mobileNavLabels[id] ?? id;
  return t(`nav.${key}`);
}

export function getNavItemIcon(id, DefaultIcon, isAdmin) {
  if (id === "admin" && !isAdmin) return Settings;
  return DefaultIcon;
}

export function getMobileNavLabel(id, t, isAdmin) {
  return getNavItemLabel(id, t, isAdmin);
}
