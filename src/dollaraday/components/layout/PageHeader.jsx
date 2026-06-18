import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import { cn } from "@/lib/utils";
import LanguageToggle from "./LanguageToggle";

function HeaderHighlights({ items }) {
  if (!items?.length) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium text-gray-300 ring-1 ring-white/10"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PageHeader({
  title,
  description,
  action,
  titleAction,
  titleClassName,
  kicker,
  variant = "default",
  highlights,
  className,
}) {
  if (variant === "hero") {
    return (
      <header className={cn("dda-glass relative mb-4 overflow-hidden sm:mb-6", className)}>
        <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-lime-400" />
        <div className="relative p-4 sm:p-6">
          <div className="absolute right-4 top-4 z-10 sm:right-5 sm:top-5">
            <LanguageToggle />
          </div>
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-emerald-400/5 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
              <div className="flex shrink-0 justify-center sm:justify-start">
                <img
                  src={DOLLARADAY_LOGO_URL}
                  alt=""
                  draggable={false}
                  className="h-[4.5rem] w-auto max-w-[10rem] object-contain sm:h-20 sm:max-w-[11rem]"
                />
              </div>

              <div className="min-w-0 text-center sm:text-left">
                {kicker ? (
                  <p className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400 ring-1 ring-emerald-500/25">
                    {kicker}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1
                    className={cn(
                      "font-bold leading-tight tracking-tight",
                      titleClassName ?? "text-[1.75rem] text-white sm:text-3xl"
                    )}
                  >
                    {title}
                  </h1>
                  {titleAction}
                </div>
                {description ? (
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-gray-400 sm:mx-0 sm:text-[15px]">
                    {description}
                  </p>
                ) : null}
                <HeaderHighlights items={highlights} />
              </div>
            </div>

            {action ? (
              <div className="flex shrink-0 items-center lg:items-end lg:justify-end">
                {action}
              </div>
            ) : null}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "relative mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 pr-20 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-5 sm:pr-28",
        className
      )}
    >
      <div className="absolute right-0 top-0 z-10">
        <LanguageToggle />
      </div>
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-400">
            {kicker}
          </p>
        ) : null}
        <div className={cn("flex flex-wrap items-center gap-2", kicker && "mt-1.5")}>
          <h1 className={cn("font-bold tracking-tight text-white", kicker ? "text-2xl sm:text-3xl" : "text-2xl sm:text-3xl")}>
            {title}
          </h1>
          {titleAction}
        </div>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
