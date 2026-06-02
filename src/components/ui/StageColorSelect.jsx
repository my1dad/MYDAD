import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { PROJECT_STAGE_COLORS } from "../../lib/projectUtils";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export const STAGE_COLOR_LABELS = [
  "Indigo",
  "Violet",
  "Purple",
  "Pink",
  "Rose",
  "Red",
  "Orange",
  "Amber",
  "Lime",
  "Emerald",
  "Teal",
  "Cyan",
  "Sky",
  "Blue",
  "Slate",
  "Ocean",
  "Deep violet",
  "Magenta",
  "Gold",
  "Forest",
];

export const STAGE_COLOR_OPTIONS = PROJECT_STAGE_COLORS.map((value, index) => ({
  value,
  label: STAGE_COLOR_LABELS[index] ?? value,
}));

const fieldStyles = {
  default: {
    label: "text-xs font-medium text-slate-700",
    trigger:
      "border-slate-200 bg-white text-slate-900 shadow-sm focus:border-indigo-400 focus:ring-indigo-100",
  },
  contrast: {
    label: "text-xs font-semibold text-slate-900",
    trigger:
      "border-slate-400 bg-white text-slate-950 shadow-sm focus:border-indigo-600 focus:ring-indigo-200",
  },
};

export function getStageColorLabel(value) {
  return STAGE_COLOR_OPTIONS.find((opt) => opt.value === value)?.label ?? value;
}

export default function StageColorSelect({
  label,
  id,
  value,
  onChange,
  className,
  variant = "default",
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const styles = fieldStyles[variant] ?? fieldStyles.default;

  const selected =
    STAGE_COLOR_OPTIONS.find((opt) => opt.value === value) ?? STAGE_COLOR_OPTIONS[0];

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 280);
    const menuHeight = 220;
    const gap = 6;
    let top = rect.bottom + gap;

    if (top + menuHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuHeight - gap);
    }

    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - menuWidth - 8
    );

    setMenuStyle({
      position: "fixed",
      top,
      left,
      width: menuWidth,
      zIndex: 400,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (
        triggerRef.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const pickColor = (color) => {
    onChange?.(color);
    setOpen(false);
  };

  const toggleOpen = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) requestAnimationFrame(updateMenuPosition);
      return next;
    });
  };

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      {label ? (
        <label htmlFor={id} className={cn("block", styles.label)}>
          {label}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2",
          styles.trigger
        )}
      >
        <span
          className="h-5 w-5 shrink-0 rounded-md ring-1 ring-slate-200/90"
          style={{ backgroundColor: value || selected.value }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-left font-medium">
          {selected.label}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")}
        />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={label ?? "Stage color"}
              className="rounded-xl border border-slate-300 bg-white p-2.5 shadow-xl shadow-black/15"
              style={menuStyle}
            >
              <div className="grid grid-cols-5 gap-1.5">
                {STAGE_COLOR_OPTIONS.map(({ value: colorValue, label: colorLabel }) => {
                  const isSelected = value === colorValue;
                  return (
                    <button
                      key={colorValue}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-label={colorLabel}
                      title={colorLabel}
                      onClick={() => pickColor(colorValue)}
                      className={cn(
                        "group relative aspect-square w-full rounded-lg transition",
                        "ring-1 ring-slate-200/80 hover:ring-slate-300",
                        "focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
                        isSelected && "ring-2 ring-indigo-700 ring-offset-2"
                      )}
                      style={{ backgroundColor: colorValue }}
                    >
                      {isSelected ? (
                        <Check
                          className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow-sm"
                          strokeWidth={3}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
