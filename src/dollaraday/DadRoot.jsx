import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import PostAuthWorkspace from "./components/PostAuthWorkspace.jsx";

/**
 * Login stays light. App (dashboard shell) loads only after auth.
 */
const App = lazy(() => import("./App.jsx"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage.jsx"));

function resolveGuestView() {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "terms") return "terms";
  return "login";
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
    const root = document.documentElement;
    const active = Boolean(isAuthenticated && isAdmin);
    root.classList.toggle("dda-theme-admin", active);
    return () => root.classList.remove("dda-theme-admin");
  }, [isAuthenticated, isAdmin]);

  if (isAuthenticated) {
    return (
      <div
        className={`dda-app h-full w-full overflow-hidden${isAdmin ? " dda-app--admin" : ""}`}
      >
        <PostAuthWorkspace>
          <Suspense fallback={null}>
            <App />
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
