import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import PlatformPreloader from "./components/layout/PlatformPreloader";
import { showInitialPreloader, dismissInitialPreloader } from "./lib/platformPreloader";

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

  useEffect(() => {
    if (isAuthenticated) {
      showInitialPreloader("Opening dashboard");
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <Suspense
          fallback={
            <PlatformPreloader kicker="Opening dashboard" label="Loading dashboard" />
          }
        >
          <AppReady>
            <App />
          </AppReady>
        </Suspense>
      </div>
    );
  }

  if (guestView === "terms") {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <Suspense fallback={<PlatformPreloader kicker="Loading" label="Loading terms" />}>
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

/** Dismiss shell preloader once authenticated app has mounted. */
function AppReady({ children }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => dismissInitialPreloader());
    return () => cancelAnimationFrame(id);
  }, []);
  return children;
}
