import { MessageSquare } from "lucide-react";
import { openWhatsAppChat } from "../../lib/openWhatsAppChat";
import { communityChatRoom } from "../../data/mockData";
import { useLocale } from "../../i18n/LocaleContext";

export default function OpenChatRoomButton() {
  const { t } = useLocale();

  const handleOpen = () => {
    openWhatsAppChat(communityChatRoom.inviteUrl);
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-400 transition hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-300 sm:px-3 sm:text-xs"
    >
      <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.25} />
      {t("pages.members.openChat")}
    </button>
  );
}
