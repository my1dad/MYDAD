function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const fieldStyles = {
  default: {
    label: "text-xs font-medium text-slate-700",
    select:
      "border-slate-200 bg-white text-slate-900 shadow-sm focus:border-indigo-400 focus:ring-indigo-100",
  },
  contrast: {
    label: "text-xs font-semibold text-slate-900",
    select:
      "border-slate-400 bg-white text-slate-950 shadow-sm focus:border-indigo-600 focus:ring-indigo-200",
  },
};

export default function Select({ label, id, children, className, variant = "default", ...props }) {
  const styles = fieldStyles[variant] ?? fieldStyles.default;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className={cn("block", styles.label)}>
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2",
          styles.select
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
