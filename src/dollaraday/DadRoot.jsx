import { useEffect, useState } from "react";
import App from "./App.jsx";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";
import TermsOfServicePage from "./pages/TermsOfServicePage.jsx";

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

  return (
    <div className="dda-app h-full w-full overflow-hidden">
      {isAuthenticated ? (
        <App />
      ) : guestView === "terms" ? (
        <TermsOfServicePage />
      ) : (
        <DadLoginPage />
      )}
    </div>
  );
}
