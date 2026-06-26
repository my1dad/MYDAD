/** Public assets from /public — works in dev, production, and Electron (file://). */
const BASE = import.meta.env.BASE_URL ?? "/";

export const DOLLARADAY_LOGO_URL = `${BASE}dad-v2-logo-transparent.png`;
export const DOLLAR_BILL_WASHINGTON_URL = `${BASE}dollar-bill-washington.jpg`;
export const PRELOADER_LOGO_URL = `${BASE}dad-v2-logo-transparent.png`;
export const APPLE_PAY_LOGO_URL = `${BASE}payments/apple-pay.svg`;
export const APPLE_PAY_LEARN_URL =
  "https://learn.applepay.apple/why-apple-pay?cid=ppy-410-us-sem-psem-b06-0001-0003";
export const ZELLE_LOGO_URL = `${BASE}payments/zelle.png`;
export const ZELLE_URL = "https://www.zelle.com";
export const TERMS_OF_SERVICE_URL = `${BASE}my-dollar-a-day-terms-of-service.pdf`;
export const HOME_URL = "https://www.mydollaraday.com";

export function buildInviteHomeUrl(referralProId) {
  const useLocalEntry =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const url = useLocalEntry
    ? new URL("./dollaraday.html", window.location.href)
    : new URL(HOME_URL);

  const code = referralProId?.trim();
  if (code) {
    url.searchParams.set("ref", code);
  }

  return url.href;
}

export function assetUrl(relativePath) {
  const clean = String(relativePath ?? "").replace(/^\//, "");
  if (!clean) return BASE;
  return `${BASE}${clean}`;
}
