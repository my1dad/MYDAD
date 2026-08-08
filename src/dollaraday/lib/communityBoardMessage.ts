import { useMemo, useSyncExternalStore } from "react";
import { isAdminProfile } from "../../config/admin";
import { getActiveDadProfile } from "./dadProfileStorage";
import {
  getDatabaseRevision,
  readDataBin,
  subscribeInternalDatabase,
  upsertDataRecord,
} from "./internalDatabase";

const BOARD_MESSAGE_RECORD_ID = "community-board-message";
const BOARD_MESSAGE_SOURCE = "community-board-message";

export interface CommunityBoardMessage {
  body: string;
  updatedAt: string | null;
  updatedByProfileId: string | null;
  updatedByName: string | null;
}

const EMPTY_BOARD_MESSAGE: CommunityBoardMessage = {
  body: "",
  updatedAt: null,
  updatedByProfileId: null,
  updatedByName: null,
};

export function getCommunityBoardMessage(): CommunityBoardMessage {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === BOARD_MESSAGE_RECORD_ID);
  if (!record?.payload) return { ...EMPTY_BOARD_MESSAGE };

  const body = typeof record.payload.body === "string" ? record.payload.body.trim() : "";
  return {
    body,
    updatedAt: typeof record.payload.updatedAt === "string" ? record.payload.updatedAt : record.updatedAt,
    updatedByProfileId:
      typeof record.payload.updatedByProfileId === "string"
        ? record.payload.updatedByProfileId
        : null,
    updatedByName:
      typeof record.payload.updatedByName === "string" ? record.payload.updatedByName : null,
  };
}

export function saveCommunityBoardMessage(body: string): { ok: true } | { ok: false; error: string } {
  const profile = getActiveDadProfile();
  if (!isAdminProfile(profile)) {
    return { ok: false, error: "master-admin-only" };
  }

  const nextBody = String(body ?? "").trim();
  const updatedAt = new Date().toISOString();

  upsertDataRecord("settings", BOARD_MESSAGE_RECORD_ID, BOARD_MESSAGE_SOURCE, {
    body: nextBody,
    updatedAt,
    updatedByProfileId: profile?.id ?? null,
    updatedByName: profile?.displayName?.trim() || profile?.fullName?.trim() || profile?.username || "Master Admin",
  });

  return { ok: true };
}

export function useCommunityBoardMessage(): CommunityBoardMessage {
  const revision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );

  return useMemo(() => {
    void revision;
    return getCommunityBoardMessage();
  }, [revision]);
}
