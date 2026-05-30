import {
  ATTACHMENTS_BIN_DIR,
  BIN_PATH_BY_ID,
  WORKSPACE_BIN_IDS,
  buildAttachmentRelativePath,
  getBinRelativePath,
} from "./binCatalog";
import { isCurrentWorkspaceVersion, LEGACY_LOCAL_STORAGE_KEYS, WORKSPACE_VERSION } from "./workspaceConstants";

/** @typedef {"local" | "disk" | "electron"} StorageMode */

/** @type {StorageMode} */
let mode = "local";

/** @type {Record<string, unknown | null>} */
const cache = Object.create(null);

/** @type {Record<string, ReturnType<typeof setTimeout>>} */
const pendingWrites = Object.create(null);

const WRITE_DEBOUNCE_MS = 250;

function hasElectronBins() {
  return typeof window !== "undefined" && window.overDriveBins?.readJson;
}

function canUseDiskApi() {
  return typeof fetch !== "undefined";
}

function readLegacyLocalStorage(binId) {
  try {
    const raw = localStorage.getItem(binId);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function fetchBootstrap() {
  const res = await fetch("/api/bins/bootstrap");
  if (!res.ok) throw new Error(`Bootstrap failed (${res.status})`);
  return res.json();
}

async function persistToDisk(binId, payload) {
  if (mode === "electron") {
    const relPath = getBinRelativePath(binId);
    if (!relPath) return;
    await window.overDriveBins.writeJson(relPath, payload);
    return;
  }

  if (mode === "disk") {
    const res = await fetch(`/api/bins/${encodeURIComponent(binId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to save ${binId}`);
  }
}

function schedulePersist(binId) {
  if (mode === "local") {
    try {
      localStorage.setItem(binId, JSON.stringify(cache[binId]));
    } catch (err) {
      console.warn(`Could not save ${binId} to localStorage:`, err);
    }
    return;
  }

  clearTimeout(pendingWrites[binId]);
  pendingWrites[binId] = setTimeout(() => {
    persistToDisk(binId, cache[binId]).catch((err) => {
      console.warn(`Could not persist ${binId}:`, err);
    });
  }, WRITE_DEBOUNCE_MS);
}

async function migrateLegacyLocalStorageOnce() {
  if (mode === "local") return;

  let migrated = false;
  for (const binId of WORKSPACE_BIN_IDS) {
    if (cache[binId] != null) continue;
    const legacy = readLegacyLocalStorage(binId);
    if (legacy == null) continue;
    cache[binId] = legacy;
    schedulePersist(binId);
    migrated = true;
  }

  if (migrated) {
    for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Load all workspace bins into memory before the React app mounts.
 * @returns {Promise<{ mode: StorageMode, binsRoot: string | null }>}
 */
export async function initBinStorage() {
  if (hasElectronBins()) {
    mode = "electron";
    const all = await window.overDriveBins.loadAll();
    for (const binId of WORKSPACE_BIN_IDS) {
      cache[binId] = all[binId] ?? null;
    }
    await migrateLegacyLocalStorageOnce();
    return { mode, binsRoot: window.overDriveBins.getRoot?.() ?? null };
  }

  if (import.meta.env.DEV && canUseDiskApi()) {
    try {
      const bootstrap = await fetchBootstrap();
      mode = "disk";
      for (const binId of WORKSPACE_BIN_IDS) {
        cache[binId] = bootstrap[binId] ?? null;
      }
      await migrateLegacyLocalStorageOnce();
      return { mode, binsRoot: bootstrap.binsRoot ?? "./bins" };
    } catch (err) {
      console.warn("Disk bins unavailable, using localStorage:", err);
    }
  }

  mode = "local";
  for (const binId of WORKSPACE_BIN_IDS) {
    cache[binId] = readLegacyLocalStorage(binId);
  }
  return { mode, binsRoot: null };
}

export function getStorageMode() {
  return mode;
}

export function readBinPayload(binId) {
  return cache[binId] ?? null;
}

export function writeBinPayload(binId, payload) {
  cache[binId] = payload;
  schedulePersist(binId);
}

export function removeBinPayload(binId) {
  cache[binId] = null;
  schedulePersist(binId);
}

export async function flushBinStorage() {
  const jobs = WORKSPACE_BIN_IDS.filter((binId) => cache[binId] != null).map((binId) =>
    persistToDisk(binId, cache[binId])
  );
  await Promise.all(jobs);
}

export async function resetWorkspaceBinsOnDisk() {
  for (const binId of WORKSPACE_BIN_IDS) {
    cache[binId] = null;
  }
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  if (mode === "electron") {
    await window.overDriveBins.reset?.();
    return;
  }

  if (mode === "disk") {
    await fetch("/api/bins/reset", { method: "POST" });
  }
}

export async function saveAttachmentToBin(fileId, fileName, dataUrl) {
  const relativePath = buildAttachmentRelativePath(fileId, fileName);

  if (mode === "electron") {
    await window.overDriveBins.writeAttachment(relativePath, dataUrl);
    return relativePath;
  }

  if (mode === "disk") {
    const res = await fetch("/api/bins/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, fileName, dataUrl, relativePath }),
    });
    if (!res.ok) throw new Error("Failed to save attachment");
    const data = await res.json();
    return data.relativePath ?? relativePath;
  }

  return null;
}

export async function loadAttachmentFromBin(relativePath) {
  if (!relativePath) return null;

  if (mode === "electron") {
    return window.overDriveBins.readAttachment(relativePath);
  }

  if (mode === "disk") {
    const res = await fetch(`/api/bins/attachments/${encodeURIComponent(relativePath)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.dataUrl ?? null;
  }

  return null;
}

export async function hydrateAttachments(items) {
  if (!Array.isArray(items) || mode === "local") return items;

  const hydrated = [];
  for (const item of items) {
    if (item?.dataUrl || !item?.binPath) {
      hydrated.push(item);
      continue;
    }
    const dataUrl = await loadAttachmentFromBin(item.binPath);
    hydrated.push(dataUrl ? { ...item, dataUrl } : item);
  }
  return hydrated;
}

export function stripAttachmentDataUrls(items) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item?.binPath || !item?.dataUrl) return item;
    const { dataUrl, ...rest } = item;
    return rest;
  });
}

export { ATTACHMENTS_BIN_DIR, BIN_PATH_BY_ID, WORKSPACE_VERSION };
