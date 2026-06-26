import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./dollaraday.css";
import DadRoot from "./DadRoot.jsx";
import DdaStorageBootstrap from "./components/DdaStorageBootstrap.jsx";
import { DadAuthProvider } from "./context/DadAuthContext.jsx";
import { LocaleProvider } from "./i18n/LocaleContext.jsx";
import { EasternTimeProvider } from "./context/EasternTimeContext.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.dataset.booted = "1";
  createRoot(rootEl).render(
    <StrictMode>
      <LocaleProvider>
        <EasternTimeProvider>
          <DadAuthProvider>
            <DdaStorageBootstrap>
              <DadRoot />
            </DdaStorageBootstrap>
          </DadAuthProvider>
        </EasternTimeProvider>
      </LocaleProvider>
    </StrictMode>
  );
}
