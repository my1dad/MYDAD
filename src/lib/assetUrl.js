/** Public assets from /public — works in dev, production, and Electron (file://). */
const BASE = import.meta.env.BASE_URL ?? "/";

export const DOLLARADAY_LOGO_URL = `${BASE}my-dollar-a-day-logo-transparent.png`;
export const PRELOADER_LOGO_URL = `${BASE}my-dollar-a-day-logo-transparent.png`;

export function assetUrl(relativePath) {
  const clean = String(relativePath ?? "").replace(/^\//, "");
  if (!clean) return BASE;
  return `${BASE}${clean}`;
}
