const STORAGE_KEY = "over-drive-os-file-bin";

export function loadFileBin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.files)) {
        return {
          files: data.files,
          savedAt: data.savedAt ?? null,
        };
      }
    }
  } catch (err) {
    console.warn("Could not load file bin:", err);
  }
  return { files: [], savedAt: null };
}

export function saveFileBin(files) {
  try {
    const bin = {
      version: 1,
      savedAt: new Date().toISOString(),
      files,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bin));
    return bin;
  } catch (err) {
    console.warn("Could not save file bin:", err);
    return null;
  }
}
