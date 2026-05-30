/** Public assets from /public — works in dev, production, and Electron (file://). */
const BASE = import.meta.env.BASE_URL ?? "/";

export const LOGO_URL = `${BASE}over-drive-logo.png`;
export const PROFILE_ENIS_URL = `${BASE}profile-enis.png`;

export function assetUrl(relativePath) {
  const clean = String(relativePath ?? "").replace(/^\//, "");
  if (!clean) return BASE;
  return `${BASE}${clean}`;
}

/** Resolves stored avatar/logo paths (including legacy `/profile-enis.png`). */
export function resolveAssetUrl(url) {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:") || /^https?:\/\//i.test(url)) {
    return url;
  }
  return assetUrl(url);
}
