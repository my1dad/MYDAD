import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import PostAuthWorkspace from "./components/PostAuthWorkspace.jsx";
import { dismissInitialPreloader } from "./lib/platformPreloader";

const App = lazy(() => import("./App.jsx"));
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

  // Guests must never sit under the boot shell. Returning sessions dismiss in AppReady.
  useEffect(() => {
    if (!isAuthenticated) dismissInitialPreloader();
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <PostAuthWorkspace>
          <Suspense fallback={null}>
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

/** Dismiss the HTML boot shell once the authenticated app tree mounts. */
function AppReady({ children }) {
  useEffect(() => {
    const rafId = requestAnimationFrame(() => dismissInitialPreloader());
    // Belt-and-suspenders: never leave a click shield after mount.
    const timeoutId = window.setTimeout(() => dismissInitialPreloader(), 400);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);
  return children;
}
