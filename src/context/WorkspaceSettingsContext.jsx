import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadWorkspaceSettings, saveWorkspaceSettings } from "../lib/workspaceSettingsStorage";

const WorkspaceSettingsContext = createContext(null);

function normalizeTag(tag) {
  return tag.trim().replace(/\s+/g, " ");
}

export function WorkspaceSettingsProvider({ children }) {
  const [eventTags, setEventTags] = useState(() => loadWorkspaceSettings().eventTags);

  useEffect(() => {
    saveWorkspaceSettings({ eventTags });
  }, [eventTags]);

  const addEventTag = useCallback((tag) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return false;
    let added = false;
    setEventTags((prev) => {
      if (prev.some((t) => t.toLowerCase() === normalized.toLowerCase())) {
        return prev;
      }
      added = true;
      return [...prev, normalized].sort((a, b) => a.localeCompare(b));
    });
    return added;
  }, []);

  const removeEventTag = useCallback((tag) => {
    setEventTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const value = useMemo(
    () => ({ eventTags, setEventTags, addEventTag, removeEventTag }),
    [eventTags, addEventTag, removeEventTag]
  );

  return (
    <WorkspaceSettingsContext.Provider value={value}>
      {children}
    </WorkspaceSettingsContext.Provider>
  );
}

export function useWorkspaceSettings() {
  const ctx = useContext(WorkspaceSettingsContext);
  if (!ctx) {
    throw new Error("useWorkspaceSettings must be used within WorkspaceSettingsProvider");
  }
  return ctx;
}
