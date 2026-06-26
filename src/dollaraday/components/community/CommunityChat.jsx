import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, MessageCircle, Send, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "../layout/PageHeader";
import { Badge, MemberAvatar } from "../layout/DashboardCard";
import { useDadAuth } from "../../context/DadAuthContext";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";
import { useLiveRelativeTime } from "../../context/EasternTimeContext";
import { getMemberInitials } from "../../lib/memberDetails";
import { buildHandle, useAllProfileMembers } from "../../lib/memberRegistry";
import { findDadProfileById } from "../../lib/dadProfileStorage";
import {
  getDmThread,
  markDmThreadRead,
  sendCommunityDirectMessage,
  sendCommunityRoomMessage,
  useCommunityChat,
  useUnreadDmState,
} from "../../lib/communityChat";
import { consumePendingDmPartnerId } from "../../lib/communityDmNavigation";

function resolveChatPartner(selectedPartnerId, allProfiles) {
  if (!selectedPartnerId) return null;

  const member = allProfiles.find((item) => (item.profileId ?? item.id) === selectedPartnerId);
  if (member) {
    return {
      profileId: member.profileId ?? member.id,
      name: member.name,
      handle: member.handle,
    };
  }

  const profile = findDadProfileById(selectedPartnerId);
  if (profile) {
    return {
      profileId: profile.id,
      name: profile.displayName,
      handle: buildHandle(profile.username),
    };
  }

  return null;
}

function ChatTabButton({ active, onClick, icon: Icon, label, alertCount = 0 }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("dda-community-chat__tab", active && "dda-community-chat__tab--active")}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {alertCount > 0 ? (
        <span className="dda-community-chat__tab-alert" aria-label={`${alertCount} unread`}>
          {alertCount > 9 ? "9+" : alertCount}
        </span>
      ) : null}
    </button>
  );
}

function ChatTime({ sentAt }) {
  const label = useLiveRelativeTime(sentAt);
  return <span className="dda-chat-message__time">{label}</span>;
}

function ChatComposer({ placeholder, onSend, disabled = false }) {
  const { t } = useLocale();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const handleSend = () => {
    const result = onSend(body);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setError("");
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="dda-chat-composer">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={disabled}
        className="dda-chat-composer__input"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled || body.trim().length < 1}
        className="dda-chat-composer__send"
        aria-label={t("pages.community.chatSend")}
      >
        <Send className="h-4 w-4" />
      </button>
      {error ? <p className="dda-chat-composer__error">{error}</p> : null}
    </div>
  );
}

function RoomMessage({ message, isOwn }) {
  return (
    <div className={cn("dda-chat-message", isOwn && "dda-chat-message--own")}>
      {!isOwn ? (
        <MemberAvatar initials={getMemberInitials(message.fromName)} size="sm" />
      ) : null}
      <div className="dda-chat-message__bubble">
        {!isOwn ? <p className="dda-chat-message__author">{message.fromName}</p> : null}
        <p className="dda-chat-message__body">{message.body}</p>
        <ChatTime sentAt={message.sentAt} />
      </div>
    </div>
  );
}

function CommunityRoomPanel({ profileId }) {
  const { t } = useLocale();
  const { roomMessages } = useCommunityChat(profileId);
  const scrollRef = useRef(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [roomMessages.length, roomMessages[roomMessages.length - 1]?.id]);

  return (
    <div className="dda-chat-panel">
      <div className="dda-chat-panel__header">
        <Hash className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
        <div>
          <p className="dda-chat-panel__title">{t("pages.community.roomTitle")}</p>
          <p className="dda-chat-panel__subtitle">{t("pages.community.roomSubtitle")}</p>
        </div>
      </div>

      <div ref={scrollRef} className="dda-chat-panel__messages">
        {roomMessages.length ? (
          roomMessages.map((message) => (
            <RoomMessage
              key={message.id}
              message={message}
              isOwn={message.fromProfileId === profileId}
            />
          ))
        ) : (
          <p className="dda-chat-panel__empty">{t("pages.community.roomEmpty")}</p>
        )}
      </div>

      <ChatComposer
        placeholder={t("pages.community.roomPlaceholder")}
        onSend={(body) => sendCommunityRoomMessage(body)}
      />
    </div>
  );
}

function DmThreadPanel({ profileId, partner, onBack }) {
  const { t } = useLocale();
  const { dmMessages } = useCommunityChat(profileId);
  const scrollRef = useRef(null);

  const thread = useMemo(
    () => getDmThread(profileId, partner.profileId),
    [profileId, partner.profileId, dmMessages],
  );

  useEffect(() => {
    markDmThreadRead(profileId, partner.profileId);
  }, [profileId, partner.profileId, dmMessages.length]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [thread.length, thread[thread.length - 1]?.id]);

  return (
    <div className="dda-chat-panel dda-chat-panel--thread">
      <div className="dda-chat-panel__header">
        <button type="button" onClick={onBack} className="dda-chat-panel__back sm:hidden">
          {t("common.back")}
        </button>
        <MemberAvatar initials={getMemberInitials(partner.name)} size="sm" />
        <div className="min-w-0">
          <p className="dda-chat-panel__title truncate">{partner.name}</p>
          <p className="dda-chat-panel__subtitle truncate">{partner.handle}</p>
        </div>
      </div>

      <div ref={scrollRef} className="dda-chat-panel__messages">
        {thread.length ? (
          thread.map((message) => (
            <RoomMessage
              key={message.id}
              message={message}
              isOwn={message.fromProfileId === profileId}
            />
          ))
        ) : (
          <p className="dda-chat-panel__empty">{t("pages.community.dmEmpty")}</p>
        )}
      </div>

      <ChatComposer
        placeholder={t("pages.community.dmPlaceholder")}
        onSend={(body) =>
          sendCommunityDirectMessage({
            toProfileId: partner.profileId,
            body,
            recipientName: partner.name,
          })
        }
      />
    </div>
  );
}

function PrivateMessagesPanel({ profileId, selectedPartnerId, onSelectPartner }) {
  const { t } = useLocale();
  const allProfiles = useAllProfileMembers();
  const { conversations } = useCommunityChat(profileId);

  const contacts = useMemo(() => {
    return conversations.map((conversation) => {
      const member = allProfiles.find(
        (item) => (item.profileId ?? item.id) === conversation.otherProfileId,
      );

      return {
        id: conversation.otherProfileId,
        member:
          member ??
          {
            profileId: conversation.otherProfileId,
            id: conversation.otherProfileId,
            name: conversation.otherName,
            handle: conversation.otherHandle,
          },
        conversation,
      };
    });
  }, [allProfiles, conversations]);

  const selectedPartner = useMemo(() => {
    const fromProfiles = resolveChatPartner(selectedPartnerId, allProfiles);
    if (fromProfiles) return fromProfiles;

    const contact = contacts.find((item) => item.id === selectedPartnerId);
    if (!contact) return null;

    return {
      profileId: contact.id,
      name: contact.member.name,
      handle: contact.member.handle,
    };
  }, [selectedPartnerId, allProfiles, contacts]);
  const showThread = Boolean(selectedPartner);

  return (
    <div className={cn("dda-chat-private", showThread && "dda-chat-private--thread-open")}>
      <div className="dda-chat-private__sidebar">
        <div className="dda-chat-panel__header">
          <MessageCircle className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="dda-chat-panel__title">{t("pages.community.privateTitle")}</p>
            <p className="dda-chat-panel__subtitle">{t("pages.community.privateContacts")}</p>
          </div>
        </div>

        <div className="dda-chat-private__conversations">
          {contacts.length ? (
            contacts.map(({ id, member, conversation }) => {
              const isSelected = id === selectedPartnerId;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectPartner(id)}
                  className={cn(
                    "dda-chat-private__conversation",
                    isSelected && "dda-chat-private__conversation--active",
                  )}
                  aria-current={isSelected ? "true" : undefined}
                >
                  <MemberAvatar initials={getMemberInitials(member.name)} size="sm" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-white">{member.name}</span>
                      {conversation.unreadCount > 0 ? (
                        <span className="dda-chat-private__unread">{conversation.unreadCount}</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {conversation.lastMessage}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="dda-chat-panel__empty px-3 py-6">{t("pages.community.noConversations")}</p>
          )}
        </div>
      </div>

      {showThread ? (
        <DmThreadPanel
          profileId={profileId}
          partner={selectedPartner}
          onBack={() => onSelectPartner(null)}
        />
      ) : (
        <div className="dda-chat-private__placeholder hidden sm:flex">
          <MessageCircle className="h-8 w-8 text-gray-600" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-500">{t("pages.community.selectConversation")}</p>
        </div>
      )}
    </div>
  );
}

function statusBadgeVariant(status) {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  if (status === "declined" || status === "denied") return "danger";
  if (status === "paused") return "default";
  return "default";
}

function MembersPanel({ profileId, onMessage, hasUnreadFrom }) {
  const { t } = useLocale();
  const { translateStatus } = useLocalizedData();
  const allProfiles = useAllProfileMembers();

  const members = allProfiles.filter((member) => (member.profileId ?? member.id) !== profileId);

  return (
    <div className="dda-chat-panel">
      <div className="dda-chat-panel__header">
        <UserRound className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
        <div>
          <p className="dda-chat-panel__title">{t("pages.community.membersTitle")}</p>
          <p className="dda-chat-panel__subtitle">
            {t("pages.community.membersSubtitle", { count: members.length })}
          </p>
        </div>
      </div>

      <div className="dda-chat-members-list">
        {members.length ? (
          members.map((member) => {
            const memberId = member.profileId ?? member.id;
            const isSelf = memberId === profileId;
            const hasReply = hasUnreadFrom(memberId);

            return (
              <div
                key={memberId}
                className={cn(
                  "dda-chat-members-list__row",
                  hasReply && "dda-chat-members-list__row--alert",
                )}
              >
                <span className="relative shrink-0">
                  <MemberAvatar initials={getMemberInitials(member.name)} size="sm" />
                  {hasReply ? <span className="dda-chat-alert-light" aria-hidden="true" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{member.name}</span>
                    <Badge variant={statusBadgeVariant(member.status)}>
                      {translateStatus(member.status)}
                    </Badge>
                    {hasReply ? (
                      <span className="dda-chat-members-list__reply-badge">
                        {t("pages.community.newReply")}
                      </span>
                    ) : null}
                  </div>
                  <span className="block truncate text-xs text-gray-500">{member.handle}</span>
                </div>
                {!isSelf && profileId ? (
                  <button
                    type="button"
                    onClick={() => onMessage(memberId)}
                    className="dda-chat-members-list__message"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("pages.community.messageMember")}</span>
                  </button>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="dda-chat-panel__empty">{t("pages.community.membersEmpty")}</p>
        )}
      </div>
    </div>
  );
}

export default function CommunityChat() {
  const { t } = useLocale();
  const { profile, authEntryTick } = useDadAuth();
  const [activeTab, setActiveTab] = useState("room");
  const [dmPartnerId, setDmPartnerId] = useState(null);
  const profileId = profile?.id;
  const { totalUnread, hasUnreadFrom } = useUnreadDmState(profileId);

  useEffect(() => {
    setDmPartnerId(null);
    setActiveTab("room");
  }, [profileId]);

  useEffect(() => {
    const pendingPartnerId = consumePendingDmPartnerId();
    if (pendingPartnerId) {
      setDmPartnerId(pendingPartnerId);
      setActiveTab("private");
    }
  }, [profileId, authEntryTick]);

  const openPrivateChat = (partnerId) => {
    setDmPartnerId(partnerId);
    setActiveTab("private");
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t("pages.community.title")}
        description={t("pages.community.description")}
      />

      <div className="dda-community-chat">
        <div className="dda-community-chat__tabs" role="tablist">
          <ChatTabButton
            active={activeTab === "room"}
            onClick={() => setActiveTab("room")}
            icon={Hash}
            label={t("pages.community.tabRoom")}
          />
          <ChatTabButton
            active={activeTab === "private"}
            onClick={() => setActiveTab("private")}
            icon={MessageCircle}
            label={t("pages.community.tabPrivate")}
            alertCount={totalUnread}
          />
          <ChatTabButton
            active={activeTab === "members"}
            onClick={() => setActiveTab("members")}
            icon={UserRound}
            label={t("pages.community.tabMembers")}
            alertCount={totalUnread}
          />
        </div>

        <div className="dda-community-chat__body">
          {activeTab === "room" ? (
            <CommunityRoomPanel profileId={profileId} />
          ) : activeTab === "members" ? (
            <MembersPanel
              profileId={profileId}
              onMessage={openPrivateChat}
              hasUnreadFrom={hasUnreadFrom}
            />
          ) : profileId ? (
            <PrivateMessagesPanel
              profileId={profileId}
              selectedPartnerId={dmPartnerId}
              onSelectPartner={setDmPartnerId}
            />
          ) : (
            <div className="dda-chat-panel">
              <p className="dda-chat-panel__empty">{t("pages.community.signInToDm")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
