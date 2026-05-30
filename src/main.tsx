import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ensureBlankWorkspace } from "./lib/blankWorkspace";
import { initBinStorage } from "./lib/storageAdapter";

async function bootstrap() {
  await initBinStorage();
  await ensureBlankWorkspace();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
