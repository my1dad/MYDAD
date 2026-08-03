import { cn } from "@/lib/utils";
import { useAppNavigate } from "../../context/AppNavigateContext";
import HeaderActions from "./HeaderActions";
import LanguageToggle from "./LanguageToggle";

/**
 * Page-header cluster.
 * - Desktop: full HeaderActions (invite, bell, language, profile)
 * - showActions=false: language only (e.g. home bank card)
 * Mobile language lives in AppShell HeaderActions, not PageHeader.
 */
export default function HeaderToolbar({ className, languageClassName, showActions = true }) {
  const onNavigate = useAppNavigate();

  if (!showActions) {
    return (
      <div className={cn("flex items-center gap-2 overflow-visible pr-0.5 pt-0.5", className)}>
        <LanguageToggle className={languageClassName} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 overflow-visible pr-0.5 pt-0.5", className)}>
      <div className="hidden overflow-visible lg:block">
        <HeaderActions onNavigate={onNavigate} />
      </div>
    </div>
  );
}
