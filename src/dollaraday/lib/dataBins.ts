/**
 * Dollar A Day data bin catalog — maps logical domains to on-disk paths
 * under bins/profiles/dollaraday/ (dev) or packaged userData bins.
 */

export const DAD_STORAGE_PROFILE_ID = "dollaraday";

export const DAD_BINS_ROOT_LABEL = "My Dollar A Day data bins";

export type DataBinKey =
  | "members"
  | "communityPosts"
  | "contributions"
  | "allocations"
  | "adminCaptures"
  | "settings";

export interface DataBinDefinition {
  key: DataBinKey;
  binId: string;
  path: string;
  label: string;
  description: string;
}

export const DATA_BIN_DEFINITIONS: DataBinDefinition[] = [
  {
    key: "members",
    binId: "dollar-a-day-members",
    path: "dollaraday/members.json",
    label: "Members",
    description: "Member profile edits and operator notes.",
  },
  {
    key: "communityPosts",
    binId: "dollar-a-day-community-posts",
    path: "dollaraday/community-posts.json",
    label: "Community posts",
    description: "Posts created from the community board onboarding flow.",
  },
  {
    key: "contributions",
    binId: "dollar-a-day-contributions",
    path: "dollaraday/contributions.json",
    label: "Contributions",
    description: "Daily $1 contribution confirmations and amounts.",
  },
  {
    key: "allocations",
    binId: "dollar-a-day-allocations",
    path: "dollaraday/allocations.json",
    label: "Allocations",
    description: "Daily allocation notes and donation captures.",
  },
  {
    key: "adminCaptures",
    binId: "dollar-a-day-admin-captures",
    path: "dollaraday/admin-captures.json",
    label: "Admin captures",
    description: "Demo form entries and admin dashboard input.",
  },
  {
    key: "settings",
    binId: "dollar-a-day-settings",
    path: "dollaraday/settings.json",
    label: "Settings",
    description: "App-level Dollar A Day preferences and metadata.",
  },
];

export const DATA_BIN_BY_KEY = Object.fromEntries(
  DATA_BIN_DEFINITIONS.map((bin) => [bin.key, bin])
) as Record<DataBinKey, DataBinDefinition>;

export const DAD_BIN_IDS = DATA_BIN_DEFINITIONS.map((bin) => bin.binId);

export const DAD_BIN_PATH_BY_ID = Object.fromEntries(
  DATA_BIN_DEFINITIONS.map((bin) => [bin.binId, bin.path])
);

export function getDataBinDefinition(key: DataBinKey): DataBinDefinition {
  return DATA_BIN_BY_KEY[key];
}

export function getBinIdForKey(key: DataBinKey): string {
  return DATA_BIN_BY_KEY[key].binId;
}
