const STORAGE_KEY = "over-drive-os-dreamboard";

export function loadDreamboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) {
        return {
          items: data.items,
          savedAt: data.savedAt ?? null,
        };
      }
    }
  } catch (err) {
    console.warn("Could not load dreamboard:", err);
  }
  return { items: [], savedAt: null };
}

export function saveDreamboard(items) {
  try {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      items,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return payload;
  } catch (err) {
    console.warn("Could not save dreamboard:", err);
    return null;
  }
}
