import InviteHomeLink from "./InviteHomeLink";
import NotificationBell from "./NotificationBell";

export default function HeaderActions({ onNavigate }) {
  return (
    <div className="dda-header-actions">
      <InviteHomeLink />
      <NotificationBell onNavigate={onNavigate} />
    </div>
  );
}
