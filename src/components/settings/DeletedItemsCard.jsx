import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  DELETED_ITEM_TYPES,
  DELETED_ITEM_TYPE_LABELS,
  formatDeletedAt,
} from "../../data/deletedItemsData";
import { useDeletedItems } from "../../context/DeletedItemsContext";
import { useLoadingOptional } from "../../context/LoadingContext";
import { useDeletedItemsActions } from "./useDeletedItemsActions";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const TYPE_FILTER_OPTIONS = [
  { id: "all", label: "All" },
  ...DELETED_ITEM_TYPES.map((type) => ({
    id: type,
    label: DELETED_ITEM_TYPE_LABELS[type],
  })),
];

const TYPE_BADGE_STYLES = {
  project: "bg-violet-100 text-violet-700",
  task: "bg-indigo-100 text-indigo-700",
  event: "bg-sky-100 text-sky-700",
  member: "bg-emerald-100 text-emerald-700",
  file: "bg-amber-100 text-amber-700",
};

export default function DeletedItemsCard({ restoreProject, updateProjects }) {
  const { syncItems } = useDeletedItems();
  const loading = useLoadingOptional();
  const { items, restoreEntries, removeItems } = useDeletedItemsActions({
    restoreProject,
    updateProjects,
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionMessage, setActionMessage] = useState("");

  const selectAllRef = useRef(null);

  useEffect(() => {
    syncItems();
  }, [syncItems]);

  const filteredItems = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((item) => item.type === typeFilter);
  }, [items, typeFilter]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(filteredItems.map((item) => item.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredItems]);

  const allVisibleSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = filteredItems.some((item) => selectedIds.has(item.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredItems.map((item) => item.id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedEntries = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  const handleRestoreSelected = async () => {
    if (selectedEntries.length === 0) return;

    setActionMessage("");

    const runRestore = async () => {
      const { restoredIds, failures } = restoreEntries(selectedEntries);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        restoredIds.forEach((id) => next.delete(id));
        return next;
      });

      if (restoredIds.length > 0 && failures.length === 0) {
        setActionMessage(
          `Restored ${restoredIds.length} item${restoredIds.length === 1 ? "" : "s"}.`
        );
      } else if (restoredIds.length > 0 && failures.length > 0) {
        setActionMessage(
          `Restored ${restoredIds.length}. Could not restore: ${failures.map((f) => f.label).join(", ")}.`
        );
      } else if (failures.length > 0) {
        setActionMessage(failures.map((f) => `${f.label}: ${f.error}`).join(" "));
      }
    };

    if (loading?.runWithLoading) {
      await loading.runWithLoading(runRestore, "Restoring items");
    } else {
      await runRestore();
    }
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const confirmed = window.confirm(
      `Permanently delete ${ids.length} selected item${ids.length === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!confirmed) return;

    setActionMessage("");

    const runDelete = async () => {
      removeItems(ids);
      setSelectedIds(new Set());
      setActionMessage(
        `Permanently deleted ${ids.length} item${ids.length === 1 ? "" : "s"}.`
      );
    };

    if (loading?.runWithLoading) {
      await loading.runWithLoading(runDelete, "Deleting items");
    } else {
      await runDelete();
    }
  };

  const actionBusy = Boolean(loading?.isLoading);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-slate-900">Deleted items</h3>
        <p className="mt-1 text-xs text-slate-500">
          Select items to restore them to where they were deleted from, or permanently remove them.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-4 py-3 sm:px-6">
        {TYPE_FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTypeFilter(option.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition",
              typeFilter === option.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            disabled={filteredItems.length === 0}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
          />
          Select all
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRestoreSelected}
            disabled={selectedIds.size === 0 || actionBusy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {`Restore selected${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0 || actionBusy}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {`Permanently delete${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
        </div>
      </div>

      {actionMessage ? (
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600 sm:px-6">
          {actionMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <th className="w-10 px-4 py-2.5 sm:px-6">
                <span className="sr-only">Select</span>
              </th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">Details</th>
              <th className="px-4 py-2.5 sm:px-6">Deleted</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Trash2 className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No deleted items</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {typeFilter === "all"
                      ? "Deleted projects, tasks, events, members, and files will appear here."
                      : `No deleted ${DELETED_ITEM_TYPE_LABELS[typeFilter]?.toLowerCase() ?? "items"} yet.`}
                  </p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const selected = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "border-b border-slate-100 text-sm transition",
                      index % 2 === 0 ? "bg-white" : "bg-slate-50/80",
                      selected && "bg-indigo-50/60"
                    )}
                  >
                    <td className="px-4 py-3 sm:px-6">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select ${item.label}`}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          TYPE_BADGE_STYLES[item.type] ?? "bg-slate-100 text-slate-600"
                        )}
                      >
                        {DELETED_ITEM_TYPE_LABELS[item.type] ?? item.type}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 font-medium text-slate-800 sm:max-w-none">
                      {item.label}
                    </td>
                    <td className="hidden max-w-[200px] truncate px-3 py-3 text-xs text-slate-500 sm:table-cell">
                      {item.meta || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 sm:px-6">
                      {formatDeletedAt(item.deletedAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
