import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

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

function formatTriggerLabel(members, selectedIds) {
  if (selectedIds.length === 0) return "Select team members";
  const selected = members.filter((member) => selectedIds.includes(member.id));
  if (selected.length === 0) return "Select team members";
  if (selected.length === 1) return selected[0].name;
  if (selected.length === 2) return selected.map((m) => m.name).join(", ");
  return `${selected.length} team members selected`;
}

export default function TeamMembersMultiSelect({
  label = "Team Members",
  id,
  members = [],
  value = [],
  onChange,
  className,
  variant = "default",
  workloadByMemberId = {},
  emptyHint = "Add team members on the Team page to assign them here.",
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const styles = fieldStyles[variant] ?? fieldStyles.default;

  const selectedIds = useMemo(
    () => value.filter((memberId) => members.some((member) => member.id === memberId)),
    [value, members]
  );

  const triggerLabel = formatTriggerLabel(members, selectedIds);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 280);
    const rowHeight = 52;
    const menuHeight = Math.min(members.length * rowHeight + 16, 280);
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
  }, [members.length]);

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

  const toggleMember = (memberId) => {
    const next = selectedIds.includes(memberId)
      ? selectedIds.filter((id) => id !== memberId)
      : [...selectedIds, memberId];
    onChange?.(next);
  };

  const toggleOpen = () => {
    if (members.length === 0) return;
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) requestAnimationFrame(updateMenuPosition);
      return next;
    });
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={id} className={cn("block", styles.label)}>
          {label}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={members.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2",
          styles.trigger,
          members.length === 0 && "cursor-not-allowed opacity-60"
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left font-medium",
            selectedIds.length === 0 && "text-slate-500"
          )}
        >
          {members.length === 0 ? "No team members available" : triggerLabel}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")}
        />
      </button>

      {members.length === 0 ? (
        <p className="text-[11px] font-medium text-slate-500">{emptyHint}</p>
      ) : null}

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label={label}
              aria-multiselectable="true"
              className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-300 bg-white py-1 shadow-xl shadow-black/15"
              style={menuStyle}
            >
              {members.map((member) => {
                const isSelected = selectedIds.includes(member.id);
                const workload = workloadByMemberId[member.id];
                const workloadSuffix =
                  workload != null && workload > 0 ? ` · ${workload}% workload` : "";

                return (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleMember(member.id)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                      isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isSelected
                          ? "border-indigo-700 bg-indigo-700 text-white"
                          : "border-slate-300 bg-white"
                      )}
                      aria-hidden
                    >
                      {isSelected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {member.name}
                        {workloadSuffix}
                      </span>
                      {member.role ? (
                        <span className="block truncate text-[11px] font-medium text-slate-600">
                          {member.role}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
