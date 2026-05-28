import {
  BarChart3,
  Calendar,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Map,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { icon: LayoutDashboard, label: "Home", active: true },
  { icon: Map, label: "Roadmap" },
  { icon: CheckSquare, label: "Tasks" },
  { icon: Calendar, label: "Calendar" },
  { icon: FolderKanban, label: "Projects" },
  { icon: BarChart3, label: "Reports" },
  { icon: Users, label: "Team" },
  { icon: Settings, label: "Settings" },
];

export function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200/80 bg-white/95 px-2 py-2 backdrop-blur-md lg:hidden">
      {items.slice(0, 5).map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1",
              item.active ? "text-violet-600" : "text-slate-400"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={item.active ? 2.5 : 2} />
            <span className="text-[9px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
