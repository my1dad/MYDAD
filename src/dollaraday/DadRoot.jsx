import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import PostAuthWorkspace from "./components/PostAuthWorkspace.jsx";
import { dismissInitialPreloader } from "./lib/platformPreloader";
/** Sync App — no blank Suspense gap after sign-in. Charts stay out of this import. */
import App from "./App.jsx";

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
    if (!isAuthenticated) dismissInitialPreloader();
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <PostAuthWorkspace>
          <AppReady>
            <App />
          </AppReady>
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
    const timeoutId = window.setTimeout(() => dismissInitialPreloader(), 400);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, []);
  return children;
}
