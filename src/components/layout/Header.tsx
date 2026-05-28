import { Bell, CalendarRange, ChevronDown, Plus, Search } from "lucide-react";

export function Header() {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/80 bg-white/50 px-4 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Welcome back, Alex
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Here&apos;s your project roadmap overview for Q2 2026.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          aria-label="Search"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-white" />
        </button>
        <button
          type="button"
          className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
        >
          <CalendarRange className="h-4 w-4 text-slate-400" />
          <span className="hidden sm:inline">Apr 1 – Jun 30, 2026</span>
          <span className="sm:hidden">Q2 2026</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        <button
          type="button"
          className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:from-violet-700 hover:to-blue-600"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>
    </header>
  );
}
