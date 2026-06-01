import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { freshDashboardExceptAdmin } from "./lib/freshDashboardReset.js";

function FreshResetPage() {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const runReset = async () => {
    setStatus("running");
    setError("");
    setMessage("Resetting profiles and workspace data…");

    try {
      const result = await freshDashboardExceptAdmin();
      setStatus("done");
      setMessage(
        `Fresh dashboard ready. Removed ${result.removedProfiles} profile(s). Admin profile: ${result.adminProfileId}.`
      );
      window.setTimeout(() => {
        window.location.replace("./roadmap.html#/login");
      }, 1200);
    } catch (err) {
      setStatus("error");
      setError(err?.message ?? "Reset failed.");
      setMessage("");
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#f8fafc",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: "28rem",
          width: "100%",
          borderRadius: "1rem",
          border: "1px solid #e2e8f0",
          background: "#fff",
          padding: "1.75rem",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.18em", color: "#6366f1" }}>
          FACTORY RESET
        </p>
        <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.25rem", fontWeight: 700 }}>Start a fresh dashboard</h1>
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", lineHeight: 1.6, color: "#64748b" }}>
          Keeps only the <strong>goldie</strong> admin profile, deletes every other profile, and wipes all
          projects, tasks, files, calendar data, dreamboard items, and settings from this browser.
        </p>

        {message ? (
          <p style={{ margin: "1rem 0 0", fontSize: "0.875rem", color: status === "error" ? "#b91c1c" : "#334155" }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.875rem", color: "#b91c1c" }}>{error}</p>
        ) : null}

        <button
          type="button"
          onClick={runReset}
          disabled={status === "running" || status === "done"}
          style={{
            marginTop: "1.25rem",
            width: "100%",
            border: "none",
            borderRadius: "0.75rem",
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#fff",
            background: status === "running" ? "#94a3b8" : "#4f46e5",
            cursor: status === "running" || status === "done" ? "default" : "pointer",
          }}
        >
          {status === "running" ? "Resetting…" : status === "done" ? "Redirecting…" : "Reset app now"}
        </button>
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <FreshResetPage />
    </StrictMode>
  );
}
