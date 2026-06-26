import { appendDataRecord, readDataBin } from "./internalDatabase";

export type ProfileActivityType =
  | "register"
  | "login"
  | "logout"
  | "donation"
  | "redemption"
  | "loan_request"
  | "post"
  | "referral"
  | "profile_suspend"
  | "profile_unsuspend"
  | "profile_delete"
  | "profile_edit"
  | "profile_approve"
  | "profile_deny";

export interface ProfileActivityEvent {
  id: string;
  profileId: string;
  proId?: string;
  type: ProfileActivityType;
  summary: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export function logProfileActivity(input: {
  profileId: string;
  proId?: string;
  type: ProfileActivityType;
  summary: string;
  payload?: Record<string, unknown>;
}): ProfileActivityEvent {
  const event: ProfileActivityEvent = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    profileId: input.profileId,
    proId: input.proId,
    type: input.type,
    summary: input.summary,
    occurredAt: new Date().toISOString(),
    payload: input.payload,
  };

  appendDataRecord("adminCaptures", "profile-activity", event as unknown as Record<string, unknown>);
  return event;
}

export function getProfileActivityEvents(profileId?: string, limit = 200): ProfileActivityEvent[] {
  const events = readDataBin("adminCaptures")
    .records.filter((record) => record.source === "profile-activity")
    .map((record) => record.payload as unknown as ProfileActivityEvent)
    .filter((event) => event?.profileId && event?.occurredAt);

  const filtered = profileId
    ? events.filter((event) => event.profileId === profileId)
    : events;

  return filtered
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}
