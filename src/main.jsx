import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ensureBlankWorkspace } from "./lib/blankWorkspace";
import { initBinStorage } from "./lib/storageAdapter";

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "2rem", fontFamily: "system-ui", color: "#b91c1c" }}>
          <h1>Something went wrong</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingShell() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#64748b",
      }}
    >
      Loading workspace…
    </div>
  );
}

async function bootstrap() {
  await initBinStorage();
  await ensureBlankWorkspace();

  const rootEl = document.getElementById("root");
  if (!rootEl) {
    document.body.innerHTML =
      '<p style="padding:2rem;font-family:system-ui">Missing #root element.</p>';
    return;
  }

  const root = createRoot(rootEl);
  root.render(
    <StrictMode>
      <LoadingShell />
    </StrictMode>
  );

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error(err);
  const rootEl = document.getElementById("root");
  if (rootEl) {
    rootEl.innerHTML = `<pre style="padding:2rem;color:#b91c1c;font-family:system-ui">${err?.message ?? err}</pre>`;
  }
});
