/** Controllers for the HTML shell preloader and in-app PlatformPreloader overlays. */

export function dismissInitialPreloader() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("initial-preloader");
  if (!el) return;
  el.setAttribute("data-dismissed", "1");
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
  window.setTimeout(() => {
    el.remove();
  }, 220);
}

export function showInitialPreloader(message = "Loading") {
  if (typeof document === "undefined") return;
  let el = document.getElementById("initial-preloader");
  if (!el) {
    el = document.createElement("div");
    el.id = "initial-preloader";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-label", "Loading My Dollar A Day");
    el.innerHTML = `
      <div id="initial-preloader-backdrop" aria-hidden="true"></div>
      <div id="initial-preloader-card">
        <div id="initial-preloader-shell">
          <div id="initial-preloader-stage">
            <span id="initial-preloader-glow" aria-hidden="true"></span>
            <div id="initial-preloader-ring">
              <span class="track" aria-hidden="true"></span>
              <span class="spin" aria-hidden="true"></span>
            </div>
          </div>
          <div id="initial-preloader-copy">
            <p id="initial-preloader-kicker">${message}</p>
            <p id="initial-preloader-brand">My Dollar A Day</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
  } else {
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    el.removeAttribute("data-dismissed");
    const kicker = el.querySelector("#initial-preloader-kicker");
    if (kicker) kicker.textContent = message;
  }
}
