export const DELETED_ITEM_TYPES = ["project", "task", "event", "member", "file"];

export const DELETED_ITEM_TYPE_LABELS = {
  project: "Projects",
  task: "Tasks",
  event: "Events",
  member: "Members",
  file: "Files",
};

/** Keep trash payloads small so saves don't fail on quota limits. */
export function slimDeletedItemData(type, data) {
  if (!data || typeof data !== "object") return { id: `unknown-${Date.now()}` };

  switch (type) {
    case "project":
      return {
        id: data.id,
        projectName: data.projectName ?? data.name ?? null,
        name: data.name ?? null,
        status: data.status ?? null,
      };
    case "task":
      return {
        id: data.id,
        title: data.title ?? null,
        project: data.project ?? null,
        status: data.status ?? null,
        calendarEventId: data.calendarEventId ?? null,
      };
    case "event":
      return {
        id: data.id,
        title: data.title ?? null,
        date: data.date ?? null,
        time: data.time ?? null,
        type: data.type ?? null,
        project: data.project ?? null,
      };
    case "member":
      return {
        id: data.id,
        name: data.name ?? null,
        email: data.email ?? null,
        role: data.role ?? null,
      };
    case "file":
      return {
        id: data.id,
        name: data.name ?? null,
        size: data.size ?? null,
        type: data.type ?? null,
        source: data.source ?? null,
      };
    default:
      return { id: data.id ?? `unknown-${Date.now()}` };
  }
}

export function getDeletedItemLabel(type, data) {
  if (!data) return "Untitled";
  switch (type) {
    case "project":
      return data.projectName ?? data.name ?? "Untitled project";
    case "task":
      return data.title ?? "Untitled task";
    case "event":
      return data.title ?? "Untitled event";
    case "member":
      return data.name ?? data.email ?? "Team member";
    case "file":
      return data.name ?? "Untitled file";
    default:
      return "Deleted item";
  }
}

export function getDeletedItemMeta(type, data) {
  if (!data) return "";
  switch (type) {
    case "project":
      return data.status ? String(data.status).replace(/_/g, " ") : "Project";
    case "task":
      return data.project ?? "Unassigned";
    case "event":
      return data.date ? `${data.date}${data.time ? ` · ${data.time}` : ""}` : "Calendar";
    case "member":
      return data.role ?? data.email ?? "";
    case "file": {
      const sourceLabel = data.source?.label?.trim();
      if (sourceLabel) return sourceLabel;
      if (data.source?.type) return String(data.source.type).replace(/-/g, " ");
      return data.size ? `${Math.round(data.size / 1024)} KB` : "File";
    }
    default:
      return "";
  }
}

export function cloneDeletedSnapshot(data) {
  if (!data || typeof data !== "object") return data;
  try {
    if (typeof structuredClone === "function") {
      return structuredClone(data);
    }
  } catch {
    // fall through
  }
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return { ...data };
  }
}

function stripHeavyTaskFields(task) {
  if (!task || typeof task !== "object") return task;
  const { attachments, ...rest } = task;
  if (!Array.isArray(attachments)) {
    return rest;
  }
  return {
    ...rest,
    attachments: attachments.map((attachment) => {
      if (!attachment || typeof attachment !== "object") return attachment;
      const { dataUrl, ...meta } = attachment;
      return meta;
    }),
  };
}

export function prepareDeletedSnapshot(type, data) {
  if (type === "task") {
    return cloneDeletedSnapshot(stripHeavyTaskFields(data));
  }
  return cloneDeletedSnapshot(data);
}

export function getDeletedItemSnapshot(entry) {
  if (!entry) return null;
  if (entry.snapshot && typeof entry.snapshot === "object") {
    return cloneDeletedSnapshot(entry.snapshot);
  }
  if (entry.data && typeof entry.data === "object") {
    return cloneDeletedSnapshot(entry.data);
  }
  return null;
}

export function createDeletedItemEntry(type, data) {
  const snapshot = prepareDeletedSnapshot(type, data);
  const slim = slimDeletedItemData(type, data);
  const entityId = slim.id ?? snapshot?.id ?? `unknown-${Date.now()}`;
  return {
    id: `deleted-${type}-${entityId}-${Date.now()}`,
    type,
    entityId,
    deletedAt: new Date().toISOString(),
    label: getDeletedItemLabel(type, slim),
    meta: getDeletedItemMeta(type, slim),
    data: slim,
    snapshot,
  };
}

export function groupDeletedItemsByType(items = []) {
  return DELETED_ITEM_TYPES.reduce((groups, type) => {
    groups[type] = items.filter((item) => item.type === type);
    return groups;
  }, {});
}

export function formatDeletedAt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
