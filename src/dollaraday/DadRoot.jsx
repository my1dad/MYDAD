import App from "./App.jsx";
import { useDadAuth } from "./context/DadAuthContext.jsx";
import DadLoginPage from "./pages/DadLoginPage.jsx";

export default function DadRoot() {
  const { isAuthenticated } = useDadAuth();

  if (!isAuthenticated) {
    return <DadLoginPage />;
  }

  return <App />;
}
