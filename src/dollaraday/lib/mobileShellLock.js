let lockCount = 0;
let savedBodyStyles = {};
let savedHtmlOverflow = "";

export function lockMobileShell() {
  if (lockCount === 0) {
    savedBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      inset: document.body.style.inset,
      width: document.body.style.width,
      height: document.body.style.height,
      touchAction: document.body.style.touchAction,
    };
    savedHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.inset = "0";
    document.body.style.width = "100%";
    document.body.style.height = "100%";
    document.body.style.touchAction = "manipulation";
  }

  lockCount += 1;
}

export function unlockMobileShell() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0) return;

  document.documentElement.style.overflow = savedHtmlOverflow;
  document.body.style.overflow = savedBodyStyles.overflow ?? "";
  document.body.style.position = savedBodyStyles.position ?? "";
  document.body.style.inset = savedBodyStyles.inset ?? "";
  document.body.style.width = savedBodyStyles.width ?? "";
  document.body.style.height = savedBodyStyles.height ?? "";
  document.body.style.touchAction = savedBodyStyles.touchAction ?? "";
}

export function resetMobileShellScroll(target) {
  if (target) {
    target.scrollTop = 0;
    target.scrollLeft = 0;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
