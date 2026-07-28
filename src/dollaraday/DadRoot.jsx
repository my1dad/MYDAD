import { lazy, Suspense, useEffect, useState } from "react";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";

const App = lazy(() => import("./App.jsx"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage.jsx"));

function resolveGuestView() {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "terms") return "terms";
  return "login";
}

function GuestFallback() {
  return (
    <div className="flex h-full min-h-[100dvh] w-full items-center justify-center bg-[#071013]" aria-busy="true">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-dda-green-light" />
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

  if (isAuthenticated) {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <Suspense fallback={<GuestFallback />}>
          <App />
        </Suspense>
      </div>
    );
  }

  if (guestView === "terms") {
    return (
      <div className="dda-app h-full w-full overflow-hidden">
        <Suspense fallback={<GuestFallback />}>
          <TermsOfServicePage />
        </Suspense>
      </div>
    );
  }

  // Login is statically imported so credential fields are interactive ASAP.
  return (
    <div className="dda-app h-full w-full overflow-hidden">
      <DadLoginPage />
    </div>
  );
}
