const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const isDev = !app.isPackaged;
const BINS_SUBDIR = "bins";

const BIN_MAP = {
  "over-drive-os-project-bin": "projects/project-bin.json",
  "over-drive-os-tasks": "tasks/tasks.json",
  "over-drive-os-calendar-events": "calendar/events.json",
  "over-drive-os-team-members": "team/members.json",
  "over-drive-os-file-bin": "files/file-bin.json",
  "over-drive-os-dreamboard": "dreamboard/items.json",
  "over-drive-os-workspace-settings": "settings/workspace.json",
  "over-drive-os-onboarding-draft": "drafts/onboarding.json",
  "over-drive-os-workspace-migration": "settings/migration.json",
  "over-drive-os-dreamboard-export-seq": "dreamboard/export-seq.json",
};

function getBinsRoot() {
  if (isDev) {
    return path.join(__dirname, "..", "bins");
  }
  return path.join(app.getPath("userData"), BINS_SUBDIR);
}

async function ensureBinsRoot() {
  const root = getBinsRoot();
  await fs.mkdir(path.join(root, "files", "attachments"), { recursive: true });
  for (const rel of Object.values(BIN_MAP)) {
    await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
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
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Over Drive OS",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  await ensureBinsRoot();

  ipcMain.handle("bins:getRoot", () => getBinsRoot());

  ipcMain.handle("bins:loadAll", async () => {
    const payload = {};
    for (const [binId, rel] of Object.entries(BIN_MAP)) {
      payload[binId] = await readJsonRelative(rel);
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

  ipcMain.handle("bins:writeAttachment", async (_event, relativePath, dataUrl) => {
    const comma = dataUrl.indexOf(",");
    const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const buffer = Buffer.from(base64, "base64");
    const filePath = path.join(getBinsRoot(), relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    await fs.writeFile(
      `${filePath}.meta.json`,
      JSON.stringify({ mime: meta.replace(/^data:/, "").replace(/;base64$/, "") }),
      "utf8"
    );
    return true;
  });

  ipcMain.handle("bins:readAttachment", async (_event, relativePath) => {
    const filePath = path.join(getBinsRoot(), relativePath);
    const sidecar = `${filePath}.meta.json`;
    const buffer = await fs.readFile(filePath);
    let mime = "application/octet-stream";
    try {
      const meta = JSON.parse(await fs.readFile(sidecar, "utf8"));
      if (meta?.mime) mime = meta.mime;
    } catch {
      // optional sidecar
    }
    return `data:${mime};base64,${buffer.toString("base64")}`;
  });

  ipcMain.handle("bins:reset", async () => {
    for (const rel of Object.values(BIN_MAP)) {
      try {
        await fs.unlink(path.join(getBinsRoot(), rel));
      } catch (err) {
        if (err?.code !== "ENOENT") throw err;
      }
    }
    const attachmentsDir = path.join(getBinsRoot(), "files", "attachments");
    try {
      const entries = await fs.readdir(attachmentsDir);
      await Promise.all(entries.map((entry) => fs.unlink(path.join(attachmentsDir, entry))));
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
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
