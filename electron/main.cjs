const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const isDev = !app.isPackaged;
const BINS_SUBDIR = "bins";
const DAD_PROFILE_ID = "dollaraday";

const BIN_MAP = {
  "dollar-a-day-members": "dollaraday/members.json",
  "dollar-a-day-community-posts": "dollaraday/community-posts.json",
  "dollar-a-day-contributions": "dollaraday/contributions.json",
  "dollar-a-day-allocations": "dollaraday/allocations.json",
  "dollar-a-day-admin-captures": "dollaraday/admin-captures.json",
  "dollar-a-day-settings": "dollaraday/settings.json",
};

function getBinsRoot() {
  if (isDev) {
    return path.join(__dirname, "..", "bins");
  }
  return path.join(app.getPath("userData"), BINS_SUBDIR);
}

function getProfilePrefix(profileId) {
  if (!profileId || !/^[a-zA-Z0-9-]+$/.test(profileId)) return "";
  return path.join("profiles", profileId);
}

function resolveProfileRoot(profileId) {
  const prefix = getProfilePrefix(profileId);
  return prefix ? path.join(getBinsRoot(), prefix) : getBinsRoot();
}

async function ensureBinsRoot() {
  const root = getBinsRoot();
  const profileRoot = path.join(root, "profiles", DAD_PROFILE_ID);
  for (const rel of Object.values(BIN_MAP)) {
    await fs.mkdir(path.dirname(path.join(profileRoot, rel)), { recursive: true });
  }
  return root;
}

async function readJsonRelative(relativePath) {
  const filePath = path.join(getBinsRoot(), relativePath);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function writeJsonRelative(relativePath, payload) {
  const filePath = path.join(getBinsRoot(), relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function createWindow() {
  const CARD_WIDTH = 1480;
  const CARD_HEIGHT = 940;
  const VIEWPORT_GAP = 12;
  const WINDOW_WIDTH = CARD_WIDTH + VIEWPORT_GAP * 2;
  const WINDOW_HEIGHT = CARD_HEIGHT + VIEWPORT_GAP * 2;

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    show: false,
    fullscreen: false,
    fullscreenable: false,
    backgroundColor: "#071013",
    title: "My Dollar A Day",
    icon: path.join(__dirname, "..", "build", "icon.icns"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => {
    win.setFullScreen(false);
    if (win.isMaximized()) {
      win.unmaximize();
    }
    win.setSize(WINDOW_WIDTH, WINDOW_HEIGHT);
    win.center();
    win.show();
  });

  if (isDev) {
    win.loadURL("http://localhost:5173/dollaraday.html");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "dollaraday.html"));
  }
}

app.whenReady().then(async () => {
  await ensureBinsRoot();

  ipcMain.handle("bins:getRoot", () => getBinsRoot());

  ipcMain.handle("bins:loadAll", async (_event, profileId) => {
    const prefix = getProfilePrefix(profileId ?? DAD_PROFILE_ID);
    const payload = {};
    for (const [binId, rel] of Object.entries(BIN_MAP)) {
      const scopedRel = prefix ? path.join(prefix, rel) : rel;
      payload[binId] = await readJsonRelative(scopedRel);
    }
    return payload;
  });

  ipcMain.handle("bins:writeJson", async (_event, relativePath, payload) => {
    await writeJsonRelative(relativePath, payload);
    return true;
  });

  ipcMain.handle("bins:readJson", async (_event, relativePath) => {
    return readJsonRelative(relativePath);
  });

  ipcMain.handle("bins:reset", async (_event, profileId) => {
    const base = resolveProfileRoot(profileId ?? DAD_PROFILE_ID);
    for (const rel of Object.values(BIN_MAP)) {
      try {
        await fs.unlink(path.join(base, rel));
      } catch (err) {
        if (err?.code !== "ENOENT") throw err;
      }
    }
    return true;
  });

  ipcMain.handle("bins:deleteProfileWorkspace", async (_event, profileId) => {
    const profileRoot = resolveProfileRoot(profileId);
    await fs.rm(profileRoot, { recursive: true, force: true });
    return true;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
