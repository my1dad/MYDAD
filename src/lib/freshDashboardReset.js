import { ADMIN_PASSWORD, ADMIN_USERNAME } from "../config/admin";
import {
  createRoadmapProfile,
  getRoadmapProfiles,
  setRoadmapSessionId,
  clearGuestSession,
} from "../data/roadmapProfileStorage";
import { resetActiveProfileWorkspace } from "./blankWorkspace";
import { cleanupDeletedRoadmapProfile } from "./profileDeletionCleanup";
import { getScopedLocalStorageKey } from "./profileWorkspaceScope";
import { WORKSPACE_BIN_IDS } from "./binCatalog";
import { LEGACY_LOCAL_STORAGE_KEYS } from "./workspaceConstants";
import { ACTIVITY_LOG_BIN_ID, clearWorkspaceActivityLog } from "./workspaceActivityLog";
import { initBinStorage } from "./storageAdapter";

const PROFILES_KEY = "overdrive-roadmap-profiles";

function isAdminUsername(username) {
  return String(username ?? "").trim().toLowerCase() === ADMIN_USERNAME;
}

function clearScopedStorageForProfile(profileId) {
  if (!profileId) return;

  for (const binId of [...WORKSPACE_BIN_IDS, ACTIVITY_LOG_BIN_ID]) {
    localStorage.removeItem(getScopedLocalStorageKey(profileId, binId));
  }

  for (const key of LEGACY_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
    localStorage.removeItem(getScopedLocalStorageKey(profileId, key));
  }
}

function ensureAdminProfile(existingProfiles) {
  const admin = existingProfiles.find((profile) => isAdminUsername(profile.username));
  if (admin) return admin;

  const created = createRoadmapProfile({
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    workspaceName: "Admin Workspace",
  });

  if ("error" in created) {
    throw new Error(created.error);
  }

  return created.profile;
}

/**
 * Deletes every roadmap profile except goldie/admin, wipes all workspace data,
 * and re-seeds an empty dashboard for the admin profile.
 */
export async function freshDashboardExceptAdmin() {
  const profiles = getRoadmapProfiles();
  const keep = profiles.filter((profile) => isAdminUsername(profile.username));
  const remove = profiles.filter((profile) => !isAdminUsername(profile.username));

  localStorage.setItem(PROFILES_KEY, JSON.stringify(keep.length ? keep : []));

  for (const profile of remove) {
    clearScopedStorageForProfile(profile.id);
    try {
      await cleanupDeletedRoadmapProfile(
        profile.id,
        keep.map((item) => item.id)
      );
    } catch (err) {
      console.warn(`Could not delete workspace for profile ${profile.id}:`, err);
    }
  }

  clearGuestSession();
  sessionStorage.removeItem("overdrive-roadmap-session");

  const admin = ensureAdminProfile(keep);
  localStorage.setItem(PROFILES_KEY, JSON.stringify([admin]));

  setRoadmapSessionId(admin.id);
  await initBinStorage(admin.id);
  clearWorkspaceActivityLog(admin.id);
  await resetActiveProfileWorkspace();

  return {
    adminProfileId: admin.id,
    removedProfiles: remove.length,
  };
}
