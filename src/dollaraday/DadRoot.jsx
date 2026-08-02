import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import { showInitialPreloader, dismissInitialPreloader } from "./lib/platformPreloader";

const App = lazy(() => import("./App.jsx"));
const PostAuthWorkspace = lazy(() => import("./components/PostAuthWorkspace.jsx"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage.jsx"));

function resolveGuestView() {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "terms") return "terms";
  return "login";
}

export default function DadRoot() {
  const { isAuthenticated } = useDadAuth();
  const [guestView, setGuestView] = useState(resolveGuestView);

  useEffect(() => {
    const syncGuestView = () => setGuestView(resolveGuestView());
    window.addEventListener("hashchange", syncGuestView);
    return () => window.removeEventListener("hashchange", syncGuestView);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Boot / first dashboard open only — never for in-app page nav.
      showInitialPreloader("Opening dashboard");
      return undefined;
    }
    // Login / terms must never sit under a stuck shell preloader.
    dismissInitialPreloader();
    return undefined;
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        {/* HTML #initial-preloader covers first open; avoid a second fullscreen React overlay. */}
        <Suspense fallback={null}>
          <PostAuthWorkspace>
            <AppReady>
              <App />
            </AppReady>
          </PostAuthWorkspace>
        </Suspense>
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
    const timeoutId = window.setTimeout(() => dismissInitialPreloader(), 800);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);
  return children;
}
