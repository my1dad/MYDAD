import { sendSignupNotifyEmail } from "../lib/signupNotifyCore.js";

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);

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

  const referer = req.headers?.referer || req.headers?.referrer;
  if (typeof referer === "string" && referer.trim()) {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }

  const host = req.headers?.["x-forwarded-host"] || req.headers?.host;
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  if (typeof host === "string" && host.trim()) return `${proto}://${host.trim()}`;
  return "";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const username = String(body?.username ?? "").trim();
    if (!username) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "username is required" }));
      return;
    }

    const result = await sendSignupNotifyEmail(body, process.env, {
      origin: resolveOrigin(req),
    });
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error("[notify-signup]", err);
    const activation = err?.code === "FORMSUBMIT_ACTIVATION_REQUIRED";
    res.statusCode = activation ? 409 : 502;
    res.end(
      JSON.stringify({
        error: err?.message ?? "Failed to send signup email",
        code: err?.code ?? "NOTIFY_FAILED",
        activationRequired: activation,
      }),
    );
  }
}
