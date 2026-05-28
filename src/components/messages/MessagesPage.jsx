import { useMemo, useState } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Phone,
  Search,
  Send,
  Video,
} from "lucide-react";
import { MESSAGE_FILTERS, MOCK_CONVERSATIONS } from "../../data/messagesData";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function ConversationAvatar({ conversation, size = "md" }) {
  const sizes = {
    sm: "h-10 w-10 text-xs",
    md: "h-11 w-11 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  if (conversation.type === "direct" && conversation.avatarUrl) {
    return (
      <img
        src={conversation.avatarUrl}
        alt={conversation.name}
        className={cn("shrink-0 rounded-full object-cover ring-2 ring-white", sizes[size])}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white",
        sizes[size],
        conversation.type === "project" && "rounded-xl"
      )}
      style={{ backgroundColor: conversation.color }}
    >
      {conversation.initials}
    </div>
  );
}

export default function MessagesPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(MOCK_CONVERSATIONS[0]?.id ?? null);
  const [draft, setDraft] = useState("");

  const unreadTotal = useMemo(
    () => MOCK_CONVERSATIONS.reduce((sum, c) => sum + c.unread, 0),
    []
  );

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return MOCK_CONVERSATIONS.filter((conversation) => {
      if (filter === "unread" && conversation.unread === 0) return false;
      if (filter === "projects" && conversation.type !== "project") return false;

      if (!query) return true;
      const haystack = `${conversation.name} ${conversation.project ?? ""} ${conversation.lastMessage}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [filter, search]);

  const selected = useMemo(
    () => MOCK_CONVERSATIONS.find((c) => c.id === selectedId) ?? filteredConversations[0] ?? null,
    [selectedId, filteredConversations]
  );

  const showThreadOnMobile = Boolean(selected && selectedId);

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col">
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-indigo-50/40 p-5 shadow-sm sm:mb-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-xl bg-indigo-500/10 px-3 py-1.5 text-sm font-bold text-indigo-700 ring-1 ring-indigo-500/15">
              <MessageSquare className="h-4 w-4" />
              Messages
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {unreadTotal > 0
                ? `${unreadTotal} unread across ${MOCK_CONVERSATIONS.length} conversations`
                : "All caught up — no unread messages"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[min(720px,calc(100dvh-13rem))] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Conversation list */}
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col border-r border-slate-200 bg-slate-50/50 md:w-80 lg:w-[340px]",
            showThreadOnMobile && "hidden md:flex"
          )}
        >
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="mt-2 flex gap-1">
              {MESSAGE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                    filter === f.id
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-slate-500">No conversations found</li>
            ) : (
              filteredConversations.map((conversation) => {
                const isActive = selected?.id === conversation.id;

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(conversation.id)}
                      className={cn(
                        "flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-left transition",
                        isActive ? "bg-white shadow-sm" : "hover:bg-white/80"
                      )}
                    >
                      <ConversationAvatar conversation={conversation} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "truncate text-sm",
                              conversation.unread > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-800"
                            )}
                          >
                            {conversation.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {conversation.time}
                          </span>
                        </div>
                        {conversation.project && (
                          <span
                            className="mt-0.5 inline-block truncate rounded-full px-1.5 py-px text-[10px] font-medium"
                            style={{
                              backgroundColor: `${conversation.projectColor}15`,
                              color: conversation.projectColor,
                            }}
                          >
                            {conversation.project}
                          </span>
                        )}
                        <p
                          className={cn(
                            "mt-1 truncate text-xs",
                            conversation.unread > 0 ? "font-medium text-slate-700" : "text-slate-500"
                          )}
                        >
                          {conversation.lastMessage}
                        </p>
                      </div>
                      {conversation.unread > 0 && (
                        <span className="mt-1 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
                          {conversation.unread}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        {/* Thread */}
        <section
          className={cn(
            "flex min-w-0 flex-1 flex-col bg-white",
            !showThreadOnMobile && !selected && "hidden md:flex",
            showThreadOnMobile ? "flex" : "hidden md:flex"
          )}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">Select a conversation</p>
              <p className="mt-1 text-xs text-slate-500">Choose a thread from the list to start reading</p>
            </div>
          ) : (
            <>
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 md:hidden"
                  >
                    ← Back
                  </button>
                  <ConversationAvatar conversation={selected} size="lg" />
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-slate-900">{selected.name}</h2>
                    <p className="truncate text-xs text-slate-500">
                      {selected.type === "project"
                        ? `Project channel · ${selected.project}`
                        : selected.project
                          ? `Direct · ${selected.project}`
                          : "Direct message"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Voice call"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Video call"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <Video className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="More options"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </header>

              <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                {selected.messages.map((message) => (
                  <li
                    key={message.id}
                    className={cn("flex", message.isSelf ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%]",
                        message.isSelf
                          ? "rounded-br-md bg-indigo-600 text-white"
                          : "rounded-bl-md bg-slate-100 text-slate-800"
                      )}
                    >
                      {!message.isSelf && selected.type === "project" && (
                        <p className="mb-0.5 text-[10px] font-semibold text-indigo-600">
                          {message.senderName}
                        </p>
                      )}
                      <p className="text-sm leading-relaxed">{message.text}</p>
                      <p
                        className={cn(
                          "mt-1 text-[10px]",
                          message.isSelf ? "text-indigo-200" : "text-slate-400"
                        )}
                      >
                        {message.time}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <footer className="shrink-0 border-t border-slate-200 p-3">
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setDraft("");
                  }}
                >
                  <button
                    type="button"
                    aria-label="Attach file"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${selected.name}…`}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
