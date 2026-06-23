import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";

export default function LanguageToggle({ className }) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-white/10 bg-black/25 p-0.5 text-xs font-semibold",
        className
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "rounded-md px-2.5 py-1 transition",
          locale === "en" ? "dda-btn-tab-active" : "text-gray-500 hover:text-gray-300"
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale("es")}
        className={cn(
          "rounded-md px-2.5 py-1 transition",
          locale === "es" ? "dda-btn-tab-active" : "text-gray-500 hover:text-gray-300"
        )}
      >
        ES
      </button>
    </div>
  );
}
