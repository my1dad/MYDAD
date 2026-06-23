import {
  Banknote,
  CalendarClock,
  CircleDollarSign,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";

export const navItems = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "allocations", icon: CalendarClock },
  { id: "members", icon: Users },
  { id: "pool", icon: PiggyBank },
  { id: "investments", icon: TrendingUp },
  { id: "accounts", icon: Wallet },
  { id: "community", icon: MessageSquare },
  { id: "admin", icon: Shield },
];

export const mobileNavItems = [
  { id: "dashboard", icon: LayoutDashboard },
  { id: "pool", icon: PiggyBank },
  { id: "investments", icon: TrendingUp },
  { id: "accounts", icon: Wallet },
];

export const mobileMoreItems = [
  { id: "allocations", icon: CalendarClock },
  { id: "members", icon: Users },
  { id: "loans", icon: Banknote },
  { id: "community", icon: MessageSquare },
  { id: "admin", icon: Shield },
];

const mobileNavLabels = {
  dashboard: "home",
  investments: "invest",
};

export default function Sidebar({ activePage, onNavigate }) {
  const { t } = useLocale();

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
        {navItems.map(({ id, icon: Icon }) => {
          const active = activePage === id;
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
              {t(`nav.${id}`)}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function getMobileNavLabel(id, t) {
  const key = mobileNavLabels[id] ?? id;
  return t(`nav.${key}`);
}
