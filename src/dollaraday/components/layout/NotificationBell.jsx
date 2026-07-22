import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, CircleDollarSign, MessageCircle, Trash2, UserCheck, UserPlus, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext";
import { useLocale } from "../../i18n/LocaleContext";
import { setPendingAdminProfileId } from "../../lib/adminProfileNavigation";
import { setPendingDmPartnerId } from "../../lib/communityDmNavigation";
import {
  clearMessageNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
} from "../../lib/notifications";
import { useLiveRelativeTime } from "../../context/EasternTimeContext";

const PANEL_WIDTH = 320;
const PANEL_GAP = 8;
const VIEWPORT_PAD = 12;

const kindIcons = {
  community_dm: MessageCircle,
  profile_pending: UserPlus,
  profile_approved: UserCheck,
  profile_denied: UserX,
  donation: CircleDollarSign,
};

function NotificationTime({ occurredAt }) {
  const label = useLiveRelativeTime(occurredAt);
  return <span className="dda-notification-item__time">{label}</span>;
}

function getNotificationTitle(item, t) {
  switch (item.kind) {
    case "community_dm":
      return item.senderName ?? t("notifications.communityDm");
    case "profile_pending":
      return item.memberName ?? t("notifications.pendingTitle");
    case "profile_approved":
      return t("notifications.approvedTitle");
    case "profile_denied":
      return t("notifications.deniedTitle");
    case "donation":
      return item.memberName ?? t("notifications.donationMember");
    default:
      return t("notifications.title");
  }
}

function getNotificationBody(item, t) {
  switch (item.kind) {
    case "community_dm":
      return item.messageBody ?? "";
    case "profile_pending":
      return t("notifications.pendingBody");
    case "profile_approved":
      return item.messageBody ?? t("notifications.approvedBody");
    case "profile_denied":
      return item.messageBody ?? t("notifications.deniedBody");
    case "donation":
      return t("notifications.donationBody", {
        amount: (item.donationAmount ?? 0).toFixed(2),
      });
    default:
      return "";
  }
}

function NotificationItem({ item, onSelect }) {
  const { t } = useLocale();
  const Icon = kindIcons[item.kind] ?? Bell;
  const title = getNotificationTitle(item, t);
  const body = getNotificationBody(item, t);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cn("dda-notification-item", item.unread && "dda-notification-item--unread")}
    >
      <span className={cn("dda-notification-item__icon", `dda-notification-item__icon--${item.kind}`)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="dda-notification-item__title">{title}</span>
        <span className="dda-notification-item__body">{body}</span>
        <span className="mt-1 flex items-center gap-2">
          <NotificationTime occurredAt={item.occurredAt} />
          {item.unread ? (
            <span className="dda-notification-item__badge">{t("notifications.unread")}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function getPanelStyle(triggerRect) {
  if (!triggerRect || typeof window === "undefined") {
    return { top: VIEWPORT_PAD, left: VIEWPORT_PAD };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(PANEL_WIDTH, viewportWidth - VIEWPORT_PAD * 2);
  const spaceBelow = viewportHeight - triggerRect.bottom - VIEWPORT_PAD;
  const spaceAbove = triggerRect.top - VIEWPORT_PAD;
  const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    160,
    Math.min(320, openUpward ? spaceAbove - PANEL_GAP : spaceBelow - PANEL_GAP),
  );

  let left = triggerRect.left;
  if (left + width > viewportWidth - VIEWPORT_PAD) {
    left = viewportWidth - VIEWPORT_PAD - width;
  }
  left = Math.max(VIEWPORT_PAD, left);

  if (openUpward) {
    return {
      left,
      width,
      bottom: viewportHeight - triggerRect.top + PANEL_GAP,
      maxHeight,
    };
  }

  return {
    left,
    width,
    top: triggerRect.bottom + PANEL_GAP,
    maxHeight,
  };
}

export default function NotificationBell({ onNavigate }) {
  const { t } = useLocale();
  const { isAdmin, profile } = useDadAuth();
  const { notifications, unreadCount } = useNotifications(isAdmin, profile?.id);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelStyle(getPanelStyle(rect));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSelect = (item) => {
    if (item.kind !== "profile_pending") {
      markNotificationRead(item.id);
    }

    if (item.kind === "community_dm" && item.dmPartnerId) {
      setPendingDmPartnerId(item.dmPartnerId);
    } else if (item.kind === "profile_pending" && item.targetProfileId) {
      setPendingAdminProfileId(item.targetProfileId);
    }

    if (item.targetPage) {
      onNavigate?.(item.targetPage);
    }

    setOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead(
      notifications.filter((item) => item.kind !== "profile_pending").map((item) => item.id),
    );
  };

  const dismissibleNotifications = notifications.filter((item) => item.kind !== "profile_pending");

  const handleClearMessages = () => {
    clearMessageNotifications(dismissibleNotifications.map((item) => item.id));
  };

  const panel =
    open && panelStyle
      ? createPortal(
          <div
            ref={panelRef}
            className="dda-notification-panel dda-notification-panel--portal"
            role="menu"
            style={panelStyle}
          >
            <div className="dda-notification-panel__header">
              <p className="dda-notification-panel__title">{t("notifications.title")}</p>
              {dismissibleNotifications.length ? (
                <div className="dda-notification-panel__actions">
                  {dismissibleNotifications.some((item) => item.unread) ? (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="dda-notification-panel__mark-all"
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("notifications.markAllRead")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleClearMessages}
                    className="dda-notification-panel__clear"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("notifications.clearMessages")}
                  </button>
                </div>
              ) : null}
            </div>

            <div
              className="dda-notification-panel__list"
              style={{ maxHeight: Math.max(120, (panelStyle.maxHeight ?? 320) - 56) }}
            >
              {notifications.length ? (
                notifications.map((item) => (
                  <NotificationItem key={item.id} item={item} onSelect={handleSelect} />
                ))
              ) : (
                <p className="dda-notification-panel__empty">{t("notifications.empty")}</p>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="dda-notification-bell">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="dda-notification-bell__trigger"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t("notifications.bellAria", { count: unreadCount })}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="dda-notification-bell__count" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {panel}
    </div>
  );
}
