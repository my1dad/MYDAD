import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { DOLLAR_BILL_WASHINGTON_URL } from "@/lib/assetUrl";
import { lockMobileShell, resetMobileShellScroll, unlockMobileShell } from "../../lib/mobileShellLock";

function assignRef(ref, node) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(node);
    return;
  }
  ref.current = node;
}

export default function MobileShell({
  variant = "app",
  scrollKey,
  shellClassName,
  mainClassName,
  contentClassName,
  footer,
  mainRef: externalMainRef,
  children,
}) {
  const mainRef = useRef(null);

  const setMainRef = useCallback(
    (node) => {
      mainRef.current = node;
      assignRef(externalMainRef, node);
    },
    [externalMainRef],
  );

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
        shellClassName,
      )}
    >
      {variant === "login" ? (
        <img
          src={DOLLAR_BILL_WASHINGTON_URL}
          alt=""
          className="dda-login-bg-portrait"
          aria-hidden="true"
          draggable={false}
          decoding="async"
        />
      ) : null}
      <main
        ref={setMainRef}
        className={cn("dda-mobile-shell__main dda-scroll", mainClassName)}
      >
        <div className={cn("dda-page-stack", contentClassName)}>{children}</div>
      </main>
      {footer ? <footer className="dda-mobile-shell__footer">{footer}</footer> : null}
    </div>
  );
}
