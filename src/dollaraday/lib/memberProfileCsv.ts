import { findDadProfileById, replaceAllDadProfiles, getDadProfiles, type DadProfile } from "./dadProfileStorage";
import { readDataBin, upsertDataRecord } from "./internalDatabase";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsv(cells: string[]): string {
  return cells.map((cell) => escapeCsvCell(cell ?? "")).join(",");
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function profileToRow(profile: DadProfile): string[] {
  return [
    "profile",
    profile.id,
    profile.username,
    profile.password,
    profile.displayName,
    profile.fullName ?? "",
    profile.email ?? "",
    profile.phone ?? "",
    profile.proId ?? "",
    profile.role ?? "",
    profile.createdAt,
    profile.lastLoginAt,
  ];
}

export function buildMemberProfileCsv(profileId: string): string | null {
  const profile = findDadProfileById(profileId);
  if (!profile) return null;

  const lines: string[] = [
    rowToCsv([
      "section",
      "id",
      "username",
      "password",
      "displayName",
      "fullName",
      "email",
      "phone",
      "proId",
      "role",
      "createdAt",
      "lastLoginAt",
    ]),
    rowToCsv(["meta", "version", "1", "profileId", profileId, "exportedAt", new Date().toISOString()]),
    rowToCsv(profileToRow(profile)),
  ];

  const memberRecord = readDataBin("members").records.find(
    (record) => record.payload?.profileId === profileId || record.id === `member-${profileId}`,
  );
  if (memberRecord) {
    lines.push(
      rowToCsv([
        "member",
        memberRecord.id,
        JSON.stringify(memberRecord.payload ?? {}),
      ]),
    );
  }

  const accountsRecord = readDataBin("settings").records.find(
    (record) => record.id === `member-accounts-${profileId}`,
  );
  if (accountsRecord) {
    lines.push(
      rowToCsv([
        "accounts",
        accountsRecord.id,
        JSON.stringify(accountsRecord.payload ?? {}),
      ]),
    );
  }

  readDataBin("contributions")
    .records.filter((record) => record.payload?.profileId === profileId)
    .forEach((record) => {
      lines.push(
        rowToCsv(["contribution", record.id, record.source, JSON.stringify(record.payload ?? {})]),
      );
    });

  return `${lines.join("\n")}\n`;
}

export function downloadMemberProfileCsv(profileId: string, filenamePrefix = "my-dollar-a-day-profile"): boolean {
  const csv = buildMemberProfileCsv(profileId);
  if (!csv) return false;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenamePrefix}-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function importMemberProfileCsv(
  profileId: string,
  text: string,
): { ok: true } | { ok: false; error: string } {
  const existing = findDadProfileById(profileId);
  if (!existing) return { ok: false, error: "Profile not found." };

  const rows = parseCsv(text);
  if (!rows.length) return { ok: false, error: "CSV file is empty." };

  let profilePatch: Partial<DadProfile> | null = null;
  let memberPayload: Record<string, unknown> | null = null;
  let accountsPayload: Record<string, unknown> | null = null;
  const contributions: Array<{ id: string; source: string; payload: Record<string, unknown> }> = [];

  for (const row of rows) {
    const section = row[0]?.trim();
    if (!section || section === "section" || section === "meta") continue;

    if (section === "profile") {
      const [, id, username, password, displayName, fullName, email, phone, proId, role, createdAt, lastLoginAt] =
        row;
      if (id !== profileId) {
        return { ok: false, error: "CSV profile does not match the signed-in member." };
      }
      profilePatch = {
        id,
        username: username?.trim() || existing.username,
        password: password?.trim() || existing.password,
        displayName: displayName?.trim() || existing.displayName,
        fullName: fullName?.trim() || displayName?.trim() || existing.fullName,
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
        proId: proId?.trim() || existing.proId,
        role: role?.trim() || existing.role,
        createdAt: createdAt?.trim() || existing.createdAt,
        lastLoginAt: lastLoginAt?.trim() || existing.lastLoginAt,
        approvalStatus: existing.approvalStatus,
        accountStatus: existing.accountStatus,
      };
      continue;
    }

    if (section === "member") {
      try {
        memberPayload = JSON.parse(row[2] ?? "{}") as Record<string, unknown>;
      } catch {
        return { ok: false, error: "Invalid member record in CSV." };
      }
      continue;
    }

    if (section === "accounts") {
      try {
        accountsPayload = JSON.parse(row[2] ?? "{}") as Record<string, unknown>;
      } catch {
        return { ok: false, error: "Invalid accounts record in CSV." };
      }
      continue;
    }

    if (section === "contribution") {
      const [, recordId, source, payloadJson] = row;
      if (!recordId || !source) continue;
      try {
        contributions.push({
          id: recordId,
          source,
          payload: JSON.parse(payloadJson ?? "{}") as Record<string, unknown>,
        });
      } catch {
        return { ok: false, error: `Invalid contribution row ${recordId}.` };
      }
    }
  }

  if (!profilePatch && !memberPayload && !accountsPayload && !contributions.length) {
    return { ok: false, error: "No importable member data found in CSV." };
  }

  if (profilePatch) {
    const profiles = getDadProfiles().map((item) =>
      item.id === profileId ? ({ ...item, ...profilePatch } as DadProfile) : item,
    );
    replaceAllDadProfiles(profiles);
  }

  if (memberPayload) {
    upsertDataRecord("members", `member-${profileId}`, "member-csv-import", memberPayload);
  }

  if (accountsPayload) {
    upsertDataRecord("settings", `member-accounts-${profileId}`, "member-csv-import", accountsPayload);
  }

  contributions.forEach((entry) => {
    upsertDataRecord("contributions", entry.id, entry.source, entry.payload);
  });

  return { ok: true };
}
