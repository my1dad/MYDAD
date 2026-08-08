import { createRoot } from "react-dom/client";
import { resetBodyScrollLock } from "@/lib/modalBodyLock";
import "./dollaraday.css";
import DadRoot from "./DadRoot.jsx";
import DdaStorageBootstrap from "./components/DdaStorageBootstrap.jsx";
import { DadAuthProvider } from "./context/DadAuthContext.jsx";
import { LocaleProvider } from "./i18n/LocaleContext.jsx";

// Clear any stuck modal body lock from a prior HMR / hard refresh mid-overlay.
resetBodyScrollLock();

const rootEl = document.getElementById("root");
if (rootEl) {
  rootEl.dataset.booted = "1";
  createRoot(rootEl).render(
    <LocaleProvider>
      <DadAuthProvider>
        <DdaStorageBootstrap>
          <DadRoot />
        </DdaStorageBootstrap>
      </DadAuthProvider>
    </LocaleProvider>,
  );
}
