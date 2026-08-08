import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "../../i18n/LocaleContext";

/** One-tap Profile for every role — avoids a member-only dropdown that gets covered on mobile. */
export default function ProfileHeaderButton({ onNavigate, className }) {
  const { t } = useLocale();

  return (
    <button
      type="button"
      onClick={() => onNavigate?.("profile")}
      className={cn("dda-profile-header-btn", className)}
      aria-label={t("nav.profile")}
      title={t("nav.profile")}
    >
      <UserRound className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
    </button>
  );
}
