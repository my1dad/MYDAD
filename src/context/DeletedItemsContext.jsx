import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { groupDeletedItemsByType } from "../data/deletedItemsData";
import {
  DELETED_ITEMS_UPDATED_EVENT,
  loadDeletedItems,
  permanentlyDeleteAllDeletedItems,
  permanentlyDeleteDeletedItems,
  resetDeletedItemsMemoryCache,
} from "../lib/deletedItemsStorage";

const DeletedItemsContext = createContext(null);

export function DeletedItemsProvider({ children }) {
  const [items, setItems] = useState(() => loadDeletedItems());

  const syncItems = useCallback(() => {
    setItems(loadDeletedItems());
  }, []);

  useEffect(() => {
    window.addEventListener(DELETED_ITEMS_UPDATED_EVENT, syncItems);
    return () => window.removeEventListener(DELETED_ITEMS_UPDATED_EVENT, syncItems);
  }, [syncItems]);

  const refresh = useCallback(() => {
    resetDeletedItemsMemoryCache();
    setItems(loadDeletedItems({ reload: true }));
  }, []);

  const clearAll = useCallback(() => {
    permanentlyDeleteAllDeletedItems();
    setItems([]);
  }, []);

  const removeItems = useCallback((ids) => {
    permanentlyDeleteDeletedItems(ids);
    setItems(loadDeletedItems());
  }, []);

  const grouped = useMemo(() => groupDeletedItemsByType(items), [items]);

  const value = useMemo(
    () => ({
      items,
      grouped,
      totalCount: items.length,
      refresh,
      syncItems,
      clearAll,
      removeItems,
    }),
    [items, grouped, refresh, syncItems, clearAll, removeItems]
  );

  return (
    <DeletedItemsContext.Provider value={value}>{children}</DeletedItemsContext.Provider>
  );
}

export function useDeletedItems() {
  const ctx = useContext(DeletedItemsContext);
  if (!ctx) {
    throw new Error("useDeletedItems must be used within DeletedItemsProvider");
  }
  return ctx;
}
