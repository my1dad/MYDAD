import { loadEnv } from "vite";
import { sendSignupNotifyEmail } from "./lib/signupNotifyCore.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function resolveOrigin(req) {
  const origin = req.headers?.origin;
  if (typeof origin === "string" && origin.trim()) return origin.trim();
  const host = req.headers?.host;
  if (typeof host === "string" && host.trim()) return `http://${host.trim()}`;
  return "http://localhost:5173";
}

export function signupNotifyPlugin() {
  function attach(server, env) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/notify-signup")) return next();
      if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

      try {
        const body = await readJsonBody(req);
        const username = String(body?.username ?? "").trim();
        if (!username) return sendJson(res, 400, { error: "username is required" });

        const result = await sendSignupNotifyEmail(body, env, {
          origin: resolveOrigin(req),
        });
        return sendJson(res, 200, result);
      } catch (err) {
        console.error("[signup-notify]", err);
        const activation = err?.code === "FORMSUBMIT_ACTIVATION_REQUIRED";
        return sendJson(res, activation ? 409 : 502, {
          error: err?.message ?? "Failed to send signup email",
          code: err?.code ?? "NOTIFY_FAILED",
          activationRequired: activation,
        });
      }
    });
  }

  return {
    name: "signup-notify",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      attach(server, { ...process.env, ...env });
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      attach(server, { ...process.env, ...env });
    },
  };
}
