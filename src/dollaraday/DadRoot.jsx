import { lazy, Suspense, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import PostAuthWorkspace from "./components/PostAuthWorkspace.jsx";
import { isSupabaseConfigured } from "./lib/supabase/client";

/**
 * Login stays light. App (dashboard shell) loads only after auth.
 * DadLoginPage also warms `./App.jsx` so the chunk is often ready on submit.
 */
const App = lazy(() => import("./App.jsx"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage.jsx"));

function resolveGuestView() {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "terms") return "terms";
  return "login";
}

function AuthBootFallback() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[var(--dda-bg,#0b1220)]"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <div className="h-10 w-10 animate-pulse rounded-full bg-white/15" />
    </div>
  );
}

function MissingSupabaseScreen() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--dda-bg,#0b1220)] px-6 text-center"
      role="alert"
    >
      <p className="text-lg font-semibold text-white">Cloud is not configured</p>
      <p className="max-w-md text-sm text-gray-400">
        This production build needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
        The app will not start from local cache.
      </p>
    </div>
  );
}

function withAnalytics(node) {
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          if (event.type !== "pageview" || typeof window === "undefined") return event;
          try {
            const url = new URL(event.url, window.location.origin);
            url.hash = window.location.hash || "";
            return { ...event, url: url.href };
          } catch {
            return event;
          }
        }}
      />
      {node}
    </>
  );
}

export default function DadRoot() {
  const { isAuthenticated, isAdmin } = useDadAuth();
  const [guestView, setGuestView] = useState(resolveGuestView);

  useEffect(() => {
    const syncGuestView = () => setGuestView(resolveGuestView());
    window.addEventListener("hashchange", syncGuestView);
    return () => window.removeEventListener("hashchange", syncGuestView);
  }, []);

  useEffect(() => {
    const sendHashPageview = () => {
      window.va?.("pageview", {
        path: `${window.location.pathname}${window.location.hash || ""}`,
        route: window.location.hash || "/",
      });
    };
    window.addEventListener("hashchange", sendHashPageview);
    return () => window.removeEventListener("hashchange", sendHashPageview);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const active = Boolean(isAuthenticated && isAdmin);
    root.classList.toggle("dda-theme-admin", active);
    return () => root.classList.remove("dda-theme-admin");
  }, [isAuthenticated, isAdmin]);

  if (import.meta.env.PROD && !isSupabaseConfigured()) {
    return withAnalytics(
      <div className="dda-app h-full w-full overflow-hidden">
        <MissingSupabaseScreen />
      </div>,
    );
  }

  if (isAuthenticated) {
    return withAnalytics(
      <div
        className={`dda-app h-full w-full overflow-hidden${isAdmin ? " dda-app--admin" : ""}`}
      >
        <PostAuthWorkspace>
          <Suspense fallback={<AuthBootFallback />}>
            <App />
          </Suspense>
        </PostAuthWorkspace>
      </div>,
    );
  }

  if (guestView === "terms") {
    return withAnalytics(
      <div className="dda-app h-full w-full overflow-hidden">
        <Suspense fallback={<AuthBootFallback />}>
          <TermsOfServicePage />
        </Suspense>
      </div>,
    );
  }

  return withAnalytics(
    <div className="dda-app h-full w-full overflow-hidden">
      <DadLoginPage />
    </div>,
  );
}
