import { cn } from "@/lib/utils";
import { useAppNavigate } from "../../context/AppNavigateContext";
import HeaderActions from "./HeaderActions";
import LanguageToggle from "./LanguageToggle";

/** Invite + notifications + language cluster for page headers (desktop). */
export default function HeaderToolbar({ className, languageClassName, showActions = true }) {
  const onNavigate = useAppNavigate();

  return (
    <div className={cn("flex items-center gap-2 overflow-visible pr-0.5 pt-0.5", className)}>
      {showActions ? (
        <div className="hidden overflow-visible lg:block">
          <HeaderActions onNavigate={onNavigate} />
        </div>
      ) : null}
      <LanguageToggle className={languageClassName} />
    </div>
  );
}
