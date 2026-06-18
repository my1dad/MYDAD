/** Opens the community WhatsApp chat room in the native app when available. */
export function openWhatsAppChat(inviteUrl) {
  if (!inviteUrl) return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.assign(inviteUrl);
    return;
  }

  window.open(inviteUrl, "_blank", "noopener,noreferrer");
}
