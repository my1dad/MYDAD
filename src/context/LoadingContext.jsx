import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppPreloader from "../components/ui/AppPreloader";

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
  const initialPageRef = useRef(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Loading workspace");

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
      setLoadingLabel("Loading workspace");
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

    setLoadingLabel(PAGE_LABELS[activePage] ?? "Loading page");

    if (initialPageRef.current) {
      initialPageRef.current = false;
      setPageReady(true);
      return undefined;
    }

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
      startLoading,
      stopLoading,
      runWithLoading,
    }),
    [isLoading, startLoading, stopLoading, runWithLoading]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {isLoading ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-50/80 backdrop-blur-[2px]"
          aria-hidden={false}
        >
          <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-8 py-7 shadow-lg shadow-slate-200/60">
            <AppPreloader label={loadingLabel} />
          </div>
        </div>
      ) : null}
    </LoadingContext.Provider>
  );
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
