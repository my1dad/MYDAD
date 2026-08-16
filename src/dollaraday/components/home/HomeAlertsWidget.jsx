import {
  Bell,
  Banknote,
  CircleDollarSign,
  Gift,
  Megaphone,
  MessageCircle,
  RefreshCw,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDadAuth } from "../../context/DadAuthContext.jsx";
import { useLocale } from "../../i18n/LocaleContext";
import { useLiveRelativeTime } from "../../context/EasternTimeContext";
import { setPendingAdminProfileId } from "../../lib/adminProfileNavigation";
import { setPendingDmPartnerId } from "../../lib/communityDmNavigation";
import {
  markNotificationRead,
  useNotifications,
} from "../../lib/notifications";

const kindIcons = {
  community_dm: MessageCircle,
  community_board: Megaphone,
  profile_pending: UserPlus,
  profile_approved: UserCheck,
  profile_denied: UserX,
  donation: CircleDollarSign,
  wallet_deposit: Wallet,
  recurring_donation: RefreshCw,
  redemption: Gift,
  payment_request: Banknote,
  redemption_request: Gift,
};

function getNotificationTitle(item, t, isAdmin) {
  switch (item.kind) {
    case "community_dm":
      return item.senderName ?? t("notifications.communityDm");
    case "community_board":
      return t("notifications.communityBoardTitle");
    case "profile_pending":
      return item.memberName ?? t("notifications.pendingTitle");
    case "profile_approved":
      return t("notifications.approvedTitle");
    case "profile_denied":
      return t("notifications.deniedTitle");
    case "wallet_deposit":
      return t("notifications.depositTitle");
    case "recurring_donation":
      return t("notifications.recurringDonationTitle");
    case "donation":
      return isAdmin
        ? (item.memberName ?? t("notifications.donationMember"))
        : t("notifications.donationTitleSelf");
    case "redemption":
      return isAdmin
        ? (item.memberName ?? t("notifications.redemptionMember"))
        : t("notifications.redemptionTitleSelf");
    case "payment_request":
      return item.memberName ?? t("notifications.paymentRequestTitle");
    case "redemption_request":
      return item.memberName ?? t("notifications.redemptionRequestTitle");
    default:
      return t("notifications.title");
  }
}

function getNotificationBody(item, t, isAdmin) {
  const amount = (item.donationAmount ?? 0).toFixed(2);
  switch (item.kind) {
    case "community_dm":
      return item.messageBody ?? "";
    case "community_board":
      return item.messageBody?.trim() || t("notifications.communityBoardBody");
    case "profile_pending":
      return t("notifications.pendingBody");
    case "profile_approved":
      return item.messageBody ?? t("notifications.approvedBody");
    case "profile_denied":
      return item.messageBody ?? t("notifications.deniedBody");
    case "wallet_deposit":
      return t("notifications.depositBody", { amount });
    case "recurring_donation":
      return t("notifications.recurringDonationBody", { amount });
    case "donation":
      return isAdmin
        ? t("notifications.donationBody", { amount })
        : t("notifications.donationBodySelf", { amount });
    case "redemption":
      return isAdmin
        ? t("notifications.redemptionBody", { amount })
        : t("notifications.redemptionBodySelf", { amount });
    case "payment_request":
      return t("notifications.paymentRequestBody", {
        amount,
        method:
          item.paymentMethod === "apple-pay"
            ? t("pages.admin.paymentMethodApplePay")
            : t("pages.admin.paymentMethodZelle"),
      });
    case "redemption_request":
      return t("notifications.redemptionRequestBody", { amount });
    default:
      return "";
  }
}

function AlertTime({ occurredAt }) {
  const label = useLiveRelativeTime(occurredAt);
  return <span className="dda-home-alerts__time">{label}</span>;
}

export default function HomeAlertsWidget({ onNavigate, className, embedded = false }) {
  const { t } = useLocale();
  const { profile, isAdmin } = useDadAuth();
  const { notifications, unreadCount } = useNotifications(isAdmin, profile?.id);
  const items = notifications.slice(0, 4);

  const openItem = (item) => {
    markNotificationRead(item.id);
    if (item.kind === "community_dm" && item.targetProfileId) {
      setPendingDmPartnerId(item.targetProfileId);
    }
    if (item.kind === "profile_pending" && (item.targetProfileId || item.targetUsername)) {
      setPendingAdminProfileId({
        profileId: item.targetProfileId,
        username: item.targetUsername,
        name: item.memberName,
      });
    }
    onNavigate?.(item.targetPage || (isAdmin ? "members" : "accounts"));
  };

  const body = (
    <div className="dda-home-alerts__body">
      <header className="dda-home-alerts__head">
        <div className="min-w-0">
          <h2 className="dda-home-alerts__title">{t("pages.dashboard.deskAlertsTitle")}</h2>
        </div>
        <span
          className={cn(
            "dda-home-alerts__badge",
            unreadCount > 0 && "dda-home-alerts__badge--live",
          )}
        >
          <Bell className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          {unreadCount > 0
            ? t("pages.dashboard.deskAlertsUnread", { count: unreadCount })
            : t("pages.dashboard.deskAlertsClear")}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="dda-home-alerts__empty">{t("pages.dashboard.deskAlertsEmpty")}</p>
      ) : (
        <ul className="dda-home-alerts__list">
          {items.map((item) => {
            const Icon = kindIcons[item.kind] ?? Bell;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "dda-home-alerts__item",
                    `dda-home-alerts__item--${item.kind}`,
                    item.unread && "dda-home-alerts__item--unread",
                  )}
                  onClick={() => openItem(item)}
                >
                  <span
                    className={cn(
                      "dda-home-alerts__item-icon",
                      `dda-home-alerts__item-icon--${item.kind}`,
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <span className="dda-home-alerts__item-copy">
                    <span className="dda-home-alerts__item-title">
                      {getNotificationTitle(item, t, isAdmin)}
                    </span>
                    <span className="dda-home-alerts__item-body">
                      {getNotificationBody(item, t, isAdmin)}
                    </span>
                    <AlertTime occurredAt={item.occurredAt} />
                  </span>
                  <ArrowUpRight
                    className="dda-home-alerts__item-arrow h-3.5 w-3.5"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div
        className={cn("dda-home-alerts", "dda-home-alerts--embedded", className)}
        aria-label={t("pages.dashboard.deskAlertsAria")}
      >
        {body}
      </div>
    );
  }

  return (
    <section
      className={cn("dda-home-alerts", className)}
      aria-label={t("pages.dashboard.deskAlertsAria")}
    >
      <div className="dda-accent-bar" />
      {body}
    </section>
  );
}
