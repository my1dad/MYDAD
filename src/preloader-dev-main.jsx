import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import PreloaderDevPage from "./pages/dev/PreloaderDevPage.jsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML =
    '<p style="padding:2rem;font-family:system-ui">Missing #root element.</p>';
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <PreloaderDevPage />
    </StrictMode>
  );
}
