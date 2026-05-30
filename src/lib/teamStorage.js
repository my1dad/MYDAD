import { DEFAULT_TEAM_MEMBERS } from "../data/teamData";
import { isCurrentWorkspaceVersion, WORKSPACE_VERSION } from "./workspaceConstants";
import { readBinPayload, writeBinPayload } from "./storageAdapter";

const STORAGE_KEY = "over-drive-os-team-members";

export function loadTeamMembers() {
  try {
    const data = readBinPayload(STORAGE_KEY);
    if (data && isCurrentWorkspaceVersion(data) && Array.isArray(data.members)) {
      return data.members;
    }
  } catch (err) {
    console.warn("Could not load team members:", err);
  }

  const members = [...DEFAULT_TEAM_MEMBERS];
  saveTeamMembers(members);
  return members;
}

export function saveTeamMembers(members) {
  try {
    writeBinPayload(STORAGE_KEY, {
      version: WORKSPACE_VERSION,
      savedAt: new Date().toISOString(),
      members,
    });
  } catch (err) {
    console.warn("Could not save team members:", err);
  }
}
