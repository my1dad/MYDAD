import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const LoadingContext = createContext(null);

export const PAGE_PRELOAD_MS = 520;
export const BOOTSTRAP_PRELOAD_MS = 680;

const PAGE_LABELS = {
  dashboard: "Loading dashboard",
  roadmap: "Loading roadmap",
  tasks: "Loading tasks",
  calendar: "Loading calendar",
  projects: "Loading projects",
  "completed-projects": "Loading projects",
  reports: "Loading reports",
  team: "Loading team",
  messages: "Loading messages",
  "file-manager": "Loading files",
  dreamboard: "Loading dreamboard",
  settings: "Loading settings",
  systems: "Loading systems",
};

function minDelay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function yieldToMain() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export function LoadingProvider({ children, activePage }) {
  const pendingRef = useRef(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Loading OverDrive");

  const syncPending = useCallback(() => {
    setPendingCount(pendingRef.current);
  }, []);

  const startLoading = useCallback(
    (label = "Loading") => {
      pendingRef.current += 1;
      setLoadingLabel(label);
      syncPending();
    },
    [syncPending]
  );

  const stopLoading = useCallback(() => {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    syncPending();
  }, [syncPending]);

  const runWithLoading = useCallback(
    async (fn, label = "Loading") => {
      startLoading(label);
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading]
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoadingLabel("Loading OverDrive");
      await Promise.all([yieldToMain(), minDelay(BOOTSTRAP_PRELOAD_MS)]);
      if (!alive) return;
      setBootstrapped(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;

    setLoadingLabel(PAGE_LABELS[activePage] ?? "Loading OverDrive");
    setPageReady(false);

    const timer = window.setTimeout(() => {
      setPageReady(true);
    }, PAGE_PRELOAD_MS);

    return () => window.clearTimeout(timer);
  }, [activePage, bootstrapped]);

  const isLoading = !bootstrapped || !pageReady || pendingCount > 0;

  const value = useMemo(
    () => ({
      isLoading,
      loadingLabel,
      startLoading,
      stopLoading,
      runWithLoading,
    }),
    [isLoading, loadingLabel, startLoading, stopLoading, runWithLoading]
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error("useLoading must be used within LoadingProvider");
  }
  return ctx;
}

export function useLoadingOptional() {
  return useContext(LoadingContext);
}
