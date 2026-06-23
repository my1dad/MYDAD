/** Public assets from /public — works in dev, production, and Electron (file://). */
const BASE = import.meta.env.BASE_URL ?? "/";

export const DOLLARADAY_LOGO_URL = `${BASE}dad-v2-logo-transparent.png`;
export const PRELOADER_LOGO_URL = `${BASE}dad-v2-logo-transparent.png`;
export const APPLE_PAY_LOGO_URL = `${BASE}payments/apple-pay.svg`;
export const APPLE_PAY_LEARN_URL =
  "https://learn.applepay.apple/why-apple-pay?cid=ppy-410-us-sem-psem-b06-0001-0003";
export const ZELLE_LOGO_URL = `${BASE}payments/zelle.png`;
export const ZELLE_URL = "https://www.zelle.com";

export function assetUrl(relativePath) {
  const clean = String(relativePath ?? "").replace(/^\//, "");
  if (!clean) return BASE;
  return `${BASE}${clean}`;
}
