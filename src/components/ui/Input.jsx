import { useRef } from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const fieldStyles = {
  default: {
    label: "text-xs font-medium text-slate-700",
    input:
      "border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-100",
  },
  contrast: {
    label: "text-xs font-semibold text-slate-900",
    input:
      "border-slate-400 bg-white text-slate-950 shadow-sm placeholder:text-slate-500 focus:border-indigo-600 focus:ring-indigo-200",
  },
};

export default function Input({ label, id, className, type, variant = "default", onClick, onFocus, ...props }) {
  const inputRef = useRef(null);
  const isDate = type === "date";
  const styles = fieldStyles[variant] ?? fieldStyles.default;

  const openDatePicker = (event) => {
    onClick?.(event);
    if (!isDate) return;

    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        input.focus();
      }
    } else {
      input.focus();
    }
  };

  const handleFocus = (event) => {
    onFocus?.(event);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            "block",
            styles.label,
            isDate && "cursor-pointer"
          )}
          onClick={
            isDate
              ? (event) => {
                  event.preventDefault();
                  openDatePicker(event);
                }
              : undefined
          }
        >
          {label}
        </label>
      )}
      <div className={cn("relative", isDate && "cursor-pointer")}>
        <input
          ref={inputRef}
          id={id}
          type={type}
          onClick={openDatePicker}
          onFocus={handleFocus}
          className={cn(
            "w-full rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2",
            styles.input,
            isDate &&
              "cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:bg-transparent [&::-webkit-calendar-picker-indicator]:opacity-0"
          )}
          {...props}
        />
      </div>
    </div>
  );
}
