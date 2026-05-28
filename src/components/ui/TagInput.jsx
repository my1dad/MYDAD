import { useState } from "react";
import { X } from "lucide-react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const fieldStyles = {
  default: {
    label: "text-xs font-medium text-slate-700",
    container: "border-slate-200 bg-white shadow-sm focus-within:border-indigo-400 focus-within:ring-indigo-100",
    tag: "bg-indigo-50 text-indigo-700",
    input: "text-slate-900 placeholder:text-slate-400",
  },
  contrast: {
    label: "text-xs font-semibold text-slate-900",
    container: "border-slate-400 bg-white shadow-sm focus-within:border-indigo-600 focus-within:ring-indigo-200",
    tag: "bg-indigo-100 text-indigo-900",
    input: "text-slate-950 placeholder:text-slate-500",
  },
};

export default function TagInput({
  label,
  tags,
  onChange,
  placeholder = "Type and press Enter",
  variant = "default",
}) {
  const [input, setInput] = useState("");
  const styles = fieldStyles[variant] ?? fieldStyles.default;

  const addTag = () => {
    const value = input.trim();
    if (value && !tags.includes(value)) {
      onChange([...tags, value]);
    }
    setInput("");
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <label className={cn("block", styles.label)}>{label}</label>}
      <div
        className={cn(
          "rounded-xl border px-3 py-2 focus-within:ring-2",
          styles.container
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium",
                styles.tag
              )}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded hover:bg-indigo-100"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={tags.length === 0 ? placeholder : ""}
            className={cn(
              "min-w-[120px] flex-1 border-0 bg-transparent py-0.5 text-sm outline-none",
              styles.input
            )}
          />
        </div>
      </div>
    </div>
  );
}
