/**
 * Platform preloader — same visual language as dollaraday.html #initial-preloader.
 * Default inline — never fullscreen during in-app nav (covers BottomNav).
 */
export default function PlatformPreloader({
  label = "Loading My Dollar A Day",
  kicker = "Loading",
  brand = "My Dollar A Day",
  fullScreen = false,
  className = "",
}) {
  return (
    <div
      className={`dda-platform-preloader${fullScreen ? " dda-platform-preloader--fullscreen" : " dda-platform-preloader--inline"}${className ? ` ${className}` : ""}`}
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="dda-platform-preloader__backdrop" aria-hidden="true" />
      <div className="dda-platform-preloader__card">
        <div className="dda-platform-preloader__shell">
          <div className="dda-platform-preloader__stage">
            <span className="dda-platform-preloader__glow" aria-hidden="true" />
            <div className="dda-platform-preloader__ring">
              <span className="dda-platform-preloader__track" aria-hidden="true" />
              <span className="dda-platform-preloader__spin" aria-hidden="true" />
            </div>
          </div>
          <div className="dda-platform-preloader__copy">
            <p className="dda-platform-preloader__kicker">{kicker}</p>
            <p className="dda-platform-preloader__brand">{brand}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
