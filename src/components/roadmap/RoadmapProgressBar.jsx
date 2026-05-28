function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const HEAT_SEGMENTS = 16;

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const num = Number.parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function mixHex(a, b, t) {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  const mix = (x, y) => Math.round(x + (y - x) * t);
  const r = mix(c1.r, c2.r);
  const g = mix(c1.g, c2.g);
  const bch = mix(c1.b, c2.b);
  return `rgb(${r}, ${g}, ${bch})`;
}

/** Cold → warm → project color heat scale at position t (0–1) */
function heatColorAt(t, hotColor) {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.35) {
    return mixHex("#e2e8f0", "#7dd3fc", clamped / 0.35);
  }
  if (clamped < 0.7) {
    return mixHex("#7dd3fc", "#fbbf24", (clamped - 0.35) / 0.35);
  }
  return mixHex("#fbbf24", hotColor, (clamped - 0.7) / 0.3);
}

function HeatmapProgressBar({ progress, color, className, heightClass, showBadge }) {
  const value = Math.max(0, Math.min(100, progress ?? 0));
  const filled = Math.round((value / 100) * HEAT_SEGMENTS);
  const displayWidth = Math.max(value, value > 0 ? 3 : 0);

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100",
        heightClass,
        className
      )}
    >
      <div className="absolute inset-0 flex gap-0.5 p-0.5">
        {Array.from({ length: HEAT_SEGMENTS }).map((_, index) => {
          const active = index < filled;
          const heatT = filled <= 1 ? 1 : index / (filled - 1);
          return (
            <div
              key={index}
              className={cn(
                "flex-1 rounded-[3px] transition-colors duration-300",
                !active && "bg-slate-200/90"
              )}
              style={
                active
                  ? {
                      background: `linear-gradient(180deg, ${heatColorAt(heatT * 0.85, color)}, ${heatColorAt(heatT, color)})`,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-l-md opacity-40 mix-blend-overlay"
        style={{ width: `${displayWidth}%` }}
      >
        <div
          className="h-full w-full"
          style={{
            background: `linear-gradient(90deg, ${heatColorAt(0, color)}, ${heatColorAt(1, color)})`,
          }}
        />
      </div>

      {showBadge && value > 0 && (
        <span
          className="absolute top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow-sm"
          style={{
            left: `clamp(8px, ${value}% - 28px, calc(100% - 40px))`,
            color: value > 55 ? "#fff" : "#0f172a",
            backgroundColor: value > 55 ? `${color}dd` : "rgba(255,255,255,0.92)",
          }}
        >
          {value}%
        </span>
      )}
    </div>
  );
}

function ClassicRoadmapProgressBar({ progress, color, className, heightClass, showBadge }) {
  const value = Math.max(0, Math.min(100, progress ?? 0));

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border border-slate-200/70 shadow-inner",
        heightClass,
        className
      )}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `repeating-linear-gradient(
            -45deg,
            #f8fafc 0px,
            #f8fafc 5px,
            #eef2f7 5px,
            #eef2f7 10px
          )`,
        }}
      />

      <div
        className="absolute inset-y-0 left-0 overflow-hidden transition-all duration-500 ease-out"
        style={{ width: `${Math.max(value, value > 0 ? 3 : 0)}%` }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              105deg,
              ${color}33 0%,
              ${color}66 35%,
              ${color}44 70%,
              ${color}55 100%
            )`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: `repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 8px,
              rgba(255,255,255,0.15) 8px,
              rgba(255,255,255,0.15) 9px
            )`,
          }}
        />
        <div className="absolute inset-y-0 right-0 w-[2px] bg-white/50" />
      </div>

      {showBadge && value > 0 && (
        <span
          className="absolute top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm"
          style={{
            left: `clamp(8px, ${value}% - 28px, calc(100% - 40px))`,
            color: value > 50 ? "#fff" : color,
            backgroundColor: value > 50 ? `${color}cc` : "rgba(255,255,255,0.85)",
          }}
        >
          {value}%
        </span>
      )}
    </div>
  );
}

export default function RoadmapProgressBar({
  progress,
  color,
  className,
  showBadge = true,
  heightClass = "h-9",
  variant = "classic",
}) {
  if (variant === "heatmap") {
    return (
      <HeatmapProgressBar
        progress={progress}
        color={color}
        className={className}
        heightClass={heightClass}
        showBadge={showBadge}
      />
    );
  }

  return (
    <ClassicRoadmapProgressBar
      progress={progress}
      color={color}
      className={className}
      heightClass={heightClass}
      showBadge={showBadge}
    />
  );
}
