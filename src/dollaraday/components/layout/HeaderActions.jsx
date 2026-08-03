import { cn } from "@/lib/utils";
import InviteHomeLink from "./InviteHomeLink";
import LanguageToggle from "./LanguageToggle";
import NotificationBell from "./NotificationBell";
import ProfileHeaderButton from "./ProfileHeaderButton";

export default function HeaderActions({ onNavigate, className }) {
  return (
    <div className={cn("dda-header-actions", className)}>
      <div className="dda-header-actions__start">
        <InviteHomeLink />
        <NotificationBell onNavigate={onNavigate} />
      </div>
      <div className="dda-header-actions__end">
        <LanguageToggle />
        <ProfileHeaderButton onNavigate={onNavigate} />
      </div>
    </div>
  );
}
