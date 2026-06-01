import { createDeletedItemEntry } from "../data/deletedItemsData";
import { logPermanentlyDeletedItem } from "./workspaceActivityLog";
import { getScopedLocalStorageKey } from "./profileWorkspaceScope";
import {
  getActiveProfileId,
  readBinPayload,
  writeBinPayload,
  writeBinPayloadImmediate,
} from "./storageAdapter";
import { WORKSPACE_VERSION } from "./workspaceConstants";

const STORAGE_KEY = "over-drive-os-deleted-items";
export const DELETED_ITEMS_UPDATED_EVENT = "deleted-items-updated";

/** In-memory source of truth for the current session. */
let memoryItems = null;

function notifyDeletedItemsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DELETED_ITEMS_UPDATED_EVENT));
  }
}

function readScopedLocalPayload() {
  const profileId = getActiveProfileId();
  if (!profileId) return null;

  try {
    const raw = localStorage.getItem(getScopedLocalStorageKey(profileId, STORAGE_KEY));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Could not read deleted items from localStorage:", err);
    return null;
  }
}

function writeScopedLocalPayload(payload) {
  const profileId = getActiveProfileId();
  if (!profileId) return false;

  try {
    localStorage.setItem(getScopedLocalStorageKey(profileId, STORAGE_KEY), JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn("Could not write deleted items to localStorage:", err);
    return false;
  }
}

function normalizeItems(data) {
  if (data && Array.isArray(data.items)) {
    return data.items;
  }
  return [];
}

function readItemsFromStorage() {
  const fromBin = normalizeItems(readBinPayload(STORAGE_KEY));
  const fromLocal = normalizeItems(readScopedLocalPayload());

  if (fromBin.length === 0) return fromLocal;
  if (fromLocal.length === 0) return fromBin;
  if (fromBin.length >= fromLocal.length) return fromBin;

  return fromLocal;
}

export function resetDeletedItemsMemoryCache() {
  memoryItems = null;
}

/** @param {{ reload?: boolean }} [options] */
export function loadDeletedItems({ reload = false } = {}) {
  if (!reload && memoryItems !== null) {
    return memoryItems;
  }

  memoryItems = readItemsFromStorage();
  return memoryItems;
}

export function saveDeletedItems(items) {
  memoryItems = items;

  const payload = {
    version: WORKSPACE_VERSION,
    savedAt: new Date().toISOString(),
    items,
  };

  try {
    void writeBinPayloadImmediate(STORAGE_KEY, payload);
    writeScopedLocalPayload(payload);
  } catch (err) {
    console.warn("Could not save deleted items:", err);
    writeBinPayload(STORAGE_KEY, payload);
  }

  notifyDeletedItemsUpdated();
}

export function archiveDeletedItem(type, data) {
  if (!data) return null;

  const entry = createDeletedItemEntry(type, data);
  const current = memoryItems !== null ? memoryItems : loadDeletedItems();
  saveDeletedItems([entry, ...current]);
  return entry;
}

export function permanentlyDeleteAllDeletedItems() {
  const current = memoryItems !== null ? memoryItems : loadDeletedItems();
  for (const entry of current) {
    logPermanentlyDeletedItem(entry);
  }
  saveDeletedItems([]);
}

export function permanentlyDeleteDeletedItems(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const idSet = new Set(ids);
  const current = memoryItems !== null ? memoryItems : loadDeletedItems();
  for (const entry of current) {
    if (idSet.has(entry.id)) {
      logPermanentlyDeletedItem(entry);
    }
  }
  saveDeletedItems(current.filter((item) => !idSet.has(item.id)));
}
