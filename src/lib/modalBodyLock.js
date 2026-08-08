let lockCount = 0;
let savedOverflow = "";

/** Force-clear any leftover body scroll lock (HMR / crashed modal teardown). */
export function resetBodyScrollLock() {
  lockCount = 0;
  if (typeof document !== "undefined") {
    document.body.style.overflow = savedOverflow || "";
  }
  savedOverflow = "";
}

/** Lock document body scroll; supports nested modals via ref counting. */
export function lockBodyScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow;
    }
  };
}

// Vite HMR can unmount modals without running effect cleanups → stuck overlay lock.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    resetBodyScrollLock();
  });
}
