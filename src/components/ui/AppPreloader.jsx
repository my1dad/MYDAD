export default function AppPreloader({ label = "Loading" }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative h-11 w-11">
        <span className="absolute inset-0 rounded-full border-2 border-slate-200/90" />
        <span className="app-preloader-spin absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-600 border-r-indigo-400" />
        <span className="app-preloader-orbit absolute inset-[11px] rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 shadow-sm shadow-indigo-500/30" />
      </div>
      <p className="text-[11px] font-semibold tracking-wide text-slate-500">{label}</p>
    </div>
  );
}
