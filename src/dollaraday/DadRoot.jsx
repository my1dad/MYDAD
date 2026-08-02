import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import PostAuthWorkspace from "./components/PostAuthWorkspace.jsx";
import { dismissInitialPreloader } from "./lib/platformPreloader";

/**
 * CRITICAL: App must stay lazy.
 * Sync-importing App pulled every page (~277KB) into the login download and made
 * first paint / every session feel dead. Login stays light; App loads after auth.
 */
const App = lazy(() => import("./App.jsx"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage.jsx"));

function resolveGuestView() {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "terms") return "terms";
  return "login";
}

function OpeningShell() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-dda-bg px-6">
      <p className="text-sm font-medium tracking-wide text-gray-400">Opening dashboard…</p>
    </div>
  );
}

export default function DadRoot() {
  const { isAuthenticated } = useDadAuth();
  const [guestView, setGuestView] = useState(resolveGuestView);

  useEffect(() => {
    const syncGuestView = () => setGuestView(resolveGuestView());
    window.addEventListener("hashchange", syncGuestView);
    return () => window.removeEventListener("hashchange", syncGuestView);
  }, []);

  // Guests must be interactive immediately. Authed path dismisses in AppReady.
  useEffect(() => {
    if (!isAuthenticated) dismissInitialPreloader();
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <PostAuthWorkspace>
          <Suspense fallback={<OpeningShell />}>
            <AppReady>
              <App />
            </AppReady>
          </Suspense>
        </PostAuthWorkspace>
      </div>
    );
  }

  if (guestView === "terms") {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <Suspense fallback={null}>
          <TermsOfServicePage />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="dda-app h-full w-full overflow-hidden">
      <DadLoginPage />
    </div>
  );
}

function AppReady({ children }) {
  useEffect(() => {
    const rafId = requestAnimationFrame(() => dismissInitialPreloader());
    const timeoutId = window.setTimeout(() => dismissInitialPreloader(), 300);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);
  return children;
}
