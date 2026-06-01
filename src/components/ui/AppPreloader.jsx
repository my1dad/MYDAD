import { PRELOADER_LOGO_URL } from "../../lib/assetUrl";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function PreloaderCopy({ label }) {
  const match = /^Loading\s+(.+)$/i.exec(label?.trim() ?? "");
  if (match) {
    return (
      <div className="app-preloader-copy text-center">
        <p className="app-preloader-kicker">Loading</p>
        <p className="app-preloader-brand">{match[1]}</p>
      </div>
    );
  }

  return <p className="app-preloader-label">{label}</p>;
}

export default function AppPreloader({ label = "Loading OverDrive" }) {
  return (
    <div
      className="app-preloader flex flex-col items-center justify-center gap-5"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="app-preloader-stage relative">
        <span className="app-preloader-glow" aria-hidden="true" />
        <div className="app-preloader-shell relative">
          <span className="app-preloader-track absolute inset-0 rounded-full border-2" />
          <span className="app-preloader-spin absolute inset-0 rounded-full border-[3px] border-transparent" />
          <span className="app-preloader-logo-wrap absolute inset-0 flex items-center justify-center">
            <img
              src={PRELOADER_LOGO_URL}
              alt=""
              aria-hidden
              draggable={false}
              className="app-preloader-logo object-contain"
            />
          </span>
        </div>
      </div>
      <PreloaderCopy label={label} />
    </div>
  );
}

export function AppPreloaderOverlay({
  label = "Loading OverDrive",
  className,
  zIndexClassName = "z-[200]",
  scope = "viewport",
}) {
  return (
    <div
      className={cn(
        "app-preloader-overlay flex items-center justify-center",
        scope === "dashboard" ? "app-preloader-overlay--dashboard absolute inset-0" : "fixed inset-0",
        zIndexClassName,
        className
      )}
      data-scope={scope}
      aria-hidden={false}
    >
      <div className="app-preloader-backdrop absolute inset-0" aria-hidden="true" />
      <div className="app-preloader-panel relative">
        <span className="app-preloader-panel-shine" aria-hidden="true" />
        <AppPreloader label={label} />
      </div>
    </div>
  );
}
