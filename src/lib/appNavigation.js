const DEFAULT_PAGE = "dashboard";

const VALID_PAGES = new Set([
  "dashboard",
  "roadmap",
  "tasks",
  "calendar",
  "projects",
  "reports",
  "team",
  "messages",
  "file-manager",
  "dreamboard",
  "settings",
  "systems",
  "account",
  "completed-projects",
]);

const VALID_SETTINGS_SECTIONS = new Set([
  "profile",
  "notifications",
  "tags",
  "appearance",
  "workspace",
  "deleted",
  "backup",
  "account",
]);

function parseHashPath() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  const path = raw.startsWith("/") ? raw.slice(1) : raw;
  return path.split("/").filter(Boolean);
}

export function readPageFromHash() {
  const segments = parseHashPath();
  const page = segments[0] || DEFAULT_PAGE;

  if (page === "settings") {
    const section = segments[1];
    return {
      page: "settings",
      settingsSection:
        section && VALID_SETTINGS_SECTIONS.has(section) ? section : "profile",
    };
  }

  if (VALID_PAGES.has(page)) {
    return { page, settingsSection: "profile" };
  }

  return { page: DEFAULT_PAGE, settingsSection: "profile" };
}

export function writePageToHash(page, { section } = {}) {
  let nextHash = "#/";

  if (page && page !== DEFAULT_PAGE) {
    if (page === "settings" && section && section !== "profile") {
      nextHash = `#/settings/${section}`;
    } else if (page === "settings") {
      nextHash = "#/settings";
    } else {
      nextHash = `#/${page}`;
    }
  }

  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

export { DEFAULT_PAGE, VALID_PAGES };
