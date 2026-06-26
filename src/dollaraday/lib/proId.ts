import { getDadProfiles } from "./dadProfileStorage";

export function sanitizeProIdBase(username: string): string {
  const base = username.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return base.slice(0, 8) || "MEMBER";
}

export function collectTakenProIds(): Set<string> {
  const taken = new Set<string>();
  getDadProfiles().forEach((profile) => {
    if (profile.proId) taken.add(profile.proId.toUpperCase());
  });
  return taken;
}

export function generateProId(username: string, taken = collectTakenProIds()): string {
  const base = sanitizeProIdBase(username);
  let candidate = `PRO-${base}`;
  let suffix = 2;

  while (taken.has(candidate.toUpperCase())) {
    candidate = `PRO-${base}${suffix}`;
    suffix += 1;
  }

  taken.add(candidate.toUpperCase());
  return candidate;
}

export function normalizeProId(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidProId(value: string): boolean {
  return /^PRO-[A-Z0-9]{2,12}$/.test(normalizeProId(value));
}
