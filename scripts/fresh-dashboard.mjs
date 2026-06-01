#!/usr/bin/env node
/**
 * Wipes on-disk workspace bins except the goldie/admin profile, then re-seeds
 * an empty workspace for goldie. Browser localStorage must be cleared separately
 * via fresh-reset.html or the in-app admin reset.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ADMIN_USERNAME = "goldie";
const WORKSPACE_VERSION = 4;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BINS_ROOT = path.resolve(__dirname, "../bins");
const PROFILES_DIR = path.join(BINS_ROOT, "profiles");

const BIN_PATHS = {
  "over-drive-os-project-bin": "projects/project-bin.json",
  "over-drive-os-tasks": "tasks/tasks.json",
  "over-drive-os-calendar-events": "calendar/events.json",
  "over-drive-os-team-members": "team/members.json",
  "over-drive-os-file-bin": "files/file-bin.json",
  "over-drive-os-dreamboard": "dreamboard/items.json",
  "over-drive-os-workspace-settings": "settings/workspace.json",
  "over-drive-os-deleted-items": "settings/deleted-items.json",
  "over-drive-os-onboarding-draft": "drafts/onboarding.json",
  "over-drive-os-workspace-migration": "settings/migration.json",
  "over-drive-os-dreamboard-export-seq": "dreamboard/export-seq.json",
};

function createEmptyWorkspaceBins() {
  const savedAt = new Date().toISOString();
  const versioned = (payload) => ({ version: WORKSPACE_VERSION, savedAt, ...payload });

  return {
    "over-drive-os-project-bin": versioned({ projects: [] }),
    "over-drive-os-tasks": versioned({ tasks: [] }),
    "over-drive-os-calendar-events": versioned({ events: [] }),
    "over-drive-os-team-members": versioned({ members: [] }),
    "over-drive-os-file-bin": versioned({ files: [] }),
    "over-drive-os-dreamboard": { version: 1, savedAt, items: [] },
    "over-drive-os-workspace-settings": versioned({
      eventTags: ["Planning", "Review", "Client", "Internal"],
    }),
    "over-drive-os-deleted-items": versioned({ items: [] }),
    "over-drive-os-onboarding-draft": null,
    "over-drive-os-workspace-migration": {
      version: WORKSPACE_VERSION,
      resetAt: savedAt,
    },
    "over-drive-os-dreamboard-export-seq": {
      date: savedAt.slice(0, 10),
      seq: 1,
    },
  };
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function findAdminProfileId() {
  let entries = [];
  try {
    entries = await fs.readdir(PROFILES_DIR, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profileId = entry.name;
    const teamPath = path.join(PROFILES_DIR, profileId, "team/members.json");
    const team = await readJson(teamPath);
    const members = team?.members;
    if (!Array.isArray(members)) continue;

    const isGoldie = members.some((member) => {
      const email = String(member?.email ?? "").toLowerCase();
      const name = String(member?.name ?? "").toLowerCase();
      return email === "goldie@overdrive.os" || name === "goldie";
    });

    if (isGoldie) return profileId;
  }

  return null;
}

async function seedEmptyWorkspace(profileRoot) {
  const seeds = createEmptyWorkspaceBins();
  await fs.mkdir(path.join(profileRoot, "files/attachments"), { recursive: true });

  for (const [binId, rel] of Object.entries(BIN_PATHS)) {
    const payload = seeds[binId];
    if (payload == null) continue;

    const filePath = path.join(profileRoot, rel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
}

async function deleteProfileDir(profileId) {
  await fs.rm(path.join(PROFILES_DIR, profileId), { recursive: true, force: true });
  console.log(`  removed workspace: ${profileId}`);
}

async function main() {
  console.log("Fresh dashboard reset (disk)\n");

  let profileEntries = [];
  try {
    profileEntries = await fs.readdir(PROFILES_DIR, { withFileTypes: true });
  } catch (err) {
    if (err?.code === "ENOENT") {
      console.log("No bins/profiles directory — nothing to clean on disk.");
      return;
    }
    throw err;
  }

  const adminProfileId = await findAdminProfileId();
  if (!adminProfileId) {
    console.warn(
      `Could not find a ${ADMIN_USERNAME} workspace on disk. All profile folders will be removed.`
    );
  } else {
    console.log(`Keeping admin workspace: ${adminProfileId}`);
  }

  const profileIds = profileEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  for (const profileId of profileIds) {
    if (profileId.startsWith("guest-") || profileId !== adminProfileId) {
      await deleteProfileDir(profileId);
    }
  }

  if (adminProfileId) {
    const adminRoot = path.join(PROFILES_DIR, adminProfileId);
    await fs.rm(adminRoot, { recursive: true, force: true });
    await fs.mkdir(adminRoot, { recursive: true });
    await seedEmptyWorkspace(adminRoot);
    console.log(`  seeded empty workspace for ${ADMIN_USERNAME}`);
  }

  console.log("\nDisk reset complete.");
  console.log("Open fresh-reset.html in your browser to clear saved profiles in localStorage.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
