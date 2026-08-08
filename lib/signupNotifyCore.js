/** Admin inbox for new membership approval alerts. */
export const ADMIN_SIGNUP_NOTIFY_EMAIL = "reppmio@gmail.com";

function buildEmail(payload = {}) {
  const displayName = String(payload.displayName ?? "").trim() || "(unknown)";
  const username = String(payload.username ?? "").trim() || "(unknown)";
  const email = String(payload.email ?? "").trim() || "(none)";
  const phone = String(payload.phone ?? "").trim() || "(none)";
  const proId = String(payload.proId ?? "").trim() || "(none)";
  const accountNumber = String(payload.accountNumber ?? "").trim() || "(none)";
  const createdAt = String(payload.createdAt ?? "").trim() || new Date().toISOString();

  const subject = `[My Dollar A Day] New profile pending approval: ${username}`;
  const text = [
    "A new member profile was created and is awaiting your approval.",
    "",
    `Name: ${displayName}`,
    `Username: ${username}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    `PRO-ID: ${proId}`,
    `Account #: ${accountNumber}`,
    `Created: ${createdAt}`,
    "",
    "Open Admin → Member management to approve or deny.",
  ].join("\n");

  return {
    subject,
    text,
    fields: {
      displayName,
      username,
      email,
      phone,
      proId,
      accountNumber,
      createdAt,
    },
  };
}

async function sendViaResend(email, env) {
  const apiKey = env?.RESEND_API_KEY;
  if (!apiKey) return null;

  const from = env.RESEND_FROM_EMAIL || "My Dollar A Day <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [ADMIN_SIGNUP_NOTIFY_EMAIL],
      subject: email.subject,
      text: email.text,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${detail || res.statusText}`);
  }

  return { ok: true, provider: "resend" };
}

function isFormSubmitSuccess(payload) {
  if (!payload || typeof payload !== "object") return false;
  const success = payload.success;
  return success === true || success === "true";
}

async function sendViaFormSubmit(email, options = {}) {
  const origin = String(options.origin ?? "").trim();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  // FormSubmit rejects server calls that look like file:// / no-origin.
  if (origin) {
    headers.Origin = origin;
    headers.Referer = `${origin}/`;
  }

  const res = await fetch(`https://formsubmit.co/ajax/${ADMIN_SIGNUP_NOTIFY_EMAIL}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      _subject: email.subject,
      _template: "table",
      name: email.fields.displayName,
      username: email.fields.username,
      email: email.fields.email,
      phone: email.fields.phone,
      proId: email.fields.proId,
      accountNumber: email.fields.accountNumber,
      createdAt: email.fields.createdAt,
      message: email.text,
    }),
  });

  const raw = await res.text().catch(() => "");
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    throw new Error(`FormSubmit failed (${res.status}): ${raw || res.statusText}`);
  }

  if (!isFormSubmitSuccess(parsed)) {
    const message =
      typeof parsed?.message === "string" && parsed.message.trim()
        ? parsed.message.trim()
        : raw || "FormSubmit did not confirm delivery";
    const err = new Error(message);
    err.code = /activat/i.test(message) ? "FORMSUBMIT_ACTIVATION_REQUIRED" : "FORMSUBMIT_FAILED";
    throw err;
  }

  return { ok: true, provider: "formsubmit" };
}

/**
 * Send new-signup approval alert to the admin inbox.
 * Prefers Resend when RESEND_API_KEY is set; otherwise FormSubmit.
 *
 * @param {object} payload
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [env]
 * @param {{ origin?: string }} [options]
 */
export async function sendSignupNotifyEmail(payload, env = process.env, options = {}) {
  const email = buildEmail(payload);

  try {
    const viaResend = await sendViaResend(email, env ?? {});
    if (viaResend) return viaResend;
  } catch (err) {
    console.warn("[signup-notify] Resend failed, trying FormSubmit:", err?.message ?? err);
  }

  return sendViaFormSubmit(email, options);
}

/** Browser-safe FormSubmit send (has a real page Origin). */
export async function sendSignupNotifyEmailFromBrowser(payload) {
  const email = buildEmail(payload);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return sendViaFormSubmit(email, { origin });
}
