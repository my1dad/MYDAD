import { Zap } from "lucide-react";

export function MobileHeader() {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-md lg:hidden">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-500">
        <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
      </div>
      <span className="text-sm font-bold text-slate-900">Over Drive OS</span>
    </div>
  );
}
