import { createRoot } from "react-dom/client";
import "./dollaraday.css";
import DadRoot from "./DadRoot.jsx";
import DdaStorageBootstrap from "./components/DdaStorageBootstrap.jsx";
import PostAuthWorkspace from "./components/PostAuthWorkspace.jsx";
import { DadAuthProvider } from "./context/DadAuthContext.jsx";
import { LocaleProvider } from "./i18n/LocaleContext.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.dataset.booted = "1";
  createRoot(rootEl).render(
    <LocaleProvider>
      <DadAuthProvider>
        <DdaStorageBootstrap>
          <PostAuthWorkspace>
            <DadRoot />
          </PostAuthWorkspace>
        </DdaStorageBootstrap>
      </DadAuthProvider>
    </LocaleProvider>,
  );
}
