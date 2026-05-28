function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const fieldStyles = {
  default: {
    label: "text-xs font-medium text-slate-700",
    textarea:
      "border-slate-200 bg-white text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-100",
  },
  contrast: {
    label: "text-xs font-semibold text-slate-900",
    textarea:
      "border-slate-400 bg-white text-slate-950 shadow-sm placeholder:text-slate-500 focus:border-indigo-600 focus:ring-indigo-200",
  },
};

export default function Textarea({
  label,
  id,
  className,
  rows = 3,
  variant = "default",
  ...props
}) {
  const styles = fieldStyles[variant] ?? fieldStyles.default;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className={cn("block", styles.label)}>
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        className={cn(
          "w-full resize-none rounded-xl border px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2",
          styles.textarea
        )}
        {...props}
      />
    </div>
  );
}
