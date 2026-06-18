import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { lockMobileShell, resetMobileShellScroll, unlockMobileShell } from "../../lib/mobileShellLock";

export default function MobileShell({
  variant = "app",
  scrollKey,
  mainClassName,
  contentClassName,
  footer,
  children,
}) {
  const mainRef = useRef(null);

  useEffect(() => {
    lockMobileShell();
    resetMobileShellScroll(mainRef.current);
    return () => unlockMobileShell();
  }, []);

  useEffect(() => {
    if (scrollKey === undefined) return;
    resetMobileShellScroll(mainRef.current);
  }, [scrollKey]);

  return (
    <div
      className={cn(
        "dda-mobile-shell",
        variant === "login" && "dda-mobile-shell--login",
        variant === "app" && "dda-mobile-shell--app",
      )}
    >
      <main
        ref={mainRef}
        className={cn("dda-mobile-shell__main dda-scroll", mainClassName)}
      >
        <div className={cn("dda-page-stack", contentClassName)}>{children}</div>
      </main>
      {footer ? <footer className="dda-mobile-shell__footer">{footer}</footer> : null}
    </div>
  );
}
