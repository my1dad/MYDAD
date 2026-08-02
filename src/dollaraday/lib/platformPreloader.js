/** Boot-only controller for the HTML `#initial-preloader` in dollaraday.html.
 * Never re-show after dismiss — that was the click-shield that broke BottomNav.
 */

export function dismissInitialPreloader() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("initial-preloader");
  if (!el) return;
  if (el.getAttribute("data-dismissed") === "1") {
    el.style.pointerEvents = "none";
    return;
  }

  // Always clear interaction blocking first — never leave a stuck click shield.
  el.style.pointerEvents = "none";
  el.setAttribute("data-dismissed", "1");
  el.setAttribute("aria-hidden", "true");
  el.style.opacity = "0";

  window.setTimeout(() => {
    if (el.parentNode) el.remove();
  }, 220);
}
