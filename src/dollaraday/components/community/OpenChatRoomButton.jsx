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
      className="inline-flex items-center gap-1.5 rounded-lg border border-dda-green/25 bg-dda-green/10 px-2.5 py-1.5 text-[11px] font-semibold text-dda-green-light transition hover:border-dda-gold-light/30 hover:bg-dda-green/15 hover:text-dda-green-soft sm:px-3 sm:text-xs"
    >
      <MessageSquare className="h-3.5 w-3.5" strokeWidth={2.25} />
      {t("pages.members.openChat")}
    </button>
  );
}
