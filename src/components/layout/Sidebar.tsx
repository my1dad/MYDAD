import {
  BarChart3,
  Calendar,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Map,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "@/data/mockData";

const iconMap = {
  LayoutDashboard,
  Map,
  CheckSquare,
  Calendar,
  FolderKanban,
  BarChart3,
  Users,
  Settings,
};

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white/70 px-4 py-6 backdrop-blur-md lg:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-500 shadow-md shadow-violet-500/25">
          <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            Over Drive
          </p>
          <p className="text-sm font-bold text-slate-900">Over Drive OS</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-gradient-to-r from-violet-600 to-blue-500 text-white shadow-md shadow-violet-500/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
        <p className="text-xs font-semibold text-violet-900">Pro Plan</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          Unlock advanced analytics and team insights.
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
        >
          Upgrade
        </button>
      </div>
    </aside>
  );
}
