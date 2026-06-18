import App from "./App.jsx";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";

export default function DadRoot() {
  const { isAuthenticated } = useDadAuth();

  return (
    <div className="dda-app h-full w-full overflow-hidden">
      {isAuthenticated ? <App /> : <DadLoginPage />}
    </div>
  );
}
