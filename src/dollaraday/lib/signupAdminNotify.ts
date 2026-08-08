import type { DadProfile } from "./dadProfileStorage";

const ADMIN_SIGNUP_NOTIFY_EMAIL = "reppmio@gmail.com";

function buildPayload(profile: DadProfile) {
  return {
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    phone: profile.phone,
    proId: profile.proId,
    accountNumber: profile.accountNumber,
    createdAt: profile.createdAt,
  };
}

async function sendViaFormSubmitBrowser(payload: ReturnType<typeof buildPayload>) {
  const subject = `[My Dollar A Day] New profile pending approval: ${payload.username}`;
  const message = [
    "A new member profile was created and is awaiting your approval.",
    "",
    `Name: ${payload.displayName || "(unknown)"}`,
    `Username: ${payload.username}`,
    `Email: ${payload.email || "(none)"}`,
    `Phone: ${payload.phone || "(none)"}`,
    `PRO-ID: ${payload.proId || "(none)"}`,
    `Account #: ${payload.accountNumber || "(none)"}`,
    `Created: ${payload.createdAt || ""}`,
    "",
    "Open Admin → Member management to approve or deny.",
  ].join("\n");

  const res = await fetch(`https://formsubmit.co/ajax/${ADMIN_SIGNUP_NOTIFY_EMAIL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: subject,
      _template: "table",
      name: payload.displayName || payload.username,
      username: payload.username,
      email: payload.email || "(none)",
      phone: payload.phone || "(none)",
      proId: payload.proId || "(none)",
      accountNumber: payload.accountNumber || "(none)",
      createdAt: payload.createdAt || "",
      message,
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    success?: boolean | string;
    message?: string;
  } | null;

  const ok = data?.success === true || data?.success === "true";
  if (!ok) {
    const detail = data?.message || `FormSubmit status ${res.status}`;
    console.warn("[signupAdminNotify] FormSubmit:", detail);
    if (/activat/i.test(detail)) {
      console.warn(
        "[signupAdminNotify] Check reppmio@gmail.com (and Spam) for FormSubmit's Activate Form email, then click it once.",
      );
    }
    return false;
  }

  return true;
}

/** Fire-and-forget admin email when a new profile registers. */
export async function notifyAdminNewSignup(profile: DadProfile): Promise<boolean> {
  const payload = buildPayload(profile);

  try {
    const res = await fetch("/api/notify-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) return true;

    const detail = await res.json().catch(() => null);
    console.warn("[signupAdminNotify] API failed:", res.status, detail);

    // Activation pending still means FormSubmit emailed the Activate link.
    if (detail?.activationRequired) {
      console.warn(
        "[signupAdminNotify] Activate FormSubmit once: open reppmio@gmail.com and click Activate Form.",
      );
      return false;
    }
  } catch (err) {
    console.warn("[signupAdminNotify] API request failed, trying browser FormSubmit:", err);
  }

  // Browser Origin path — more reliable for FormSubmit than bare server calls.
  try {
    return await sendViaFormSubmitBrowser(payload);
  } catch (err) {
    console.warn("[signupAdminNotify] Browser FormSubmit failed:", err);
    return false;
  }
}
