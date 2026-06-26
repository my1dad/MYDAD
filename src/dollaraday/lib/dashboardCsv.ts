import { getDadProfiles, replaceAllDadProfiles, type DadProfile } from "./dadProfileStorage";
import { DATA_BIN_DEFINITIONS } from "./dataBins";
import { getDatabaseSnapshot, upsertDataRecord, writeDataBin, type DataBinKey } from "./internalDatabase";
import { getPoolState, importPoolLiveState } from "./poolState";

const CSV_VERSION = "1";

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
    "member",
    profile.id,
    profile.username,
    profile.password,
    profile.displayName,
    profile.fullName ?? "",
    profile.email ?? "",
    profile.phone ?? "",
    profile.proId ?? "",
    profile.role ?? "",
    profile.approvalStatus ?? "approved",
    profile.accountStatus ?? "active",
    profile.referredByProId ?? "",
    profile.profilePhotoUrl ?? "",
    profile.createdAt,
    profile.lastLoginAt,
  ];
}

export function buildDashboardCsvExport(): string {
  const lines: string[] = [];
  lines.push(
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
      "approvalStatus",
      "accountStatus",
      "referredByProId",
      "profilePhotoUrl",
      "createdAt",
      "lastLoginAt",
    ]),
  );
  lines.push(rowToCsv(["meta", "version", CSV_VERSION, "exportedAt", new Date().toISOString()]));

  getDadProfiles().forEach((profile) => {
    lines.push(rowToCsv(profileToRow(profile)));
  });

  const pool = getPoolState();
  lines.push(
    rowToCsv([
      "pool",
      JSON.stringify(pool.poolSummary),
      JSON.stringify(pool.poolComposition),
      JSON.stringify(pool.dailyAllocationSummary),
    ]),
  );

  const snapshot = getDatabaseSnapshot();
  for (const definition of DATA_BIN_DEFINITIONS) {
    const document = snapshot.bins[definition.key];
    document.records.forEach((record) => {
      lines.push(
        rowToCsv([
          "record",
          definition.key,
          record.id,
          record.source,
          record.createdAt,
          record.updatedAt,
          JSON.stringify(record.payload),
        ]),
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

export function downloadDashboardCsv(filenamePrefix = "dollar-a-day-dashboard"): void {
  const csv = buildDashboardCsvExport();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenamePrefix}-${Date.now()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importDashboardCsv(text: string): { ok: true } | { ok: false; error: string } {
  const rows = parseCsv(text);
  if (!rows.length) {
    return { ok: false, error: "CSV file is empty." };
  }

  const profiles: DadProfile[] = [];
  let poolPayload: Partial<ReturnType<typeof getPoolState>> | null = null;
  const records: Array<{
    binKey: DataBinKey;
    recordId: string;
    source: string;
    payload: Record<string, unknown>;
  }> = [];

  for (const row of rows) {
    const section = row[0]?.trim();
    if (!section || section === "section") continue;

    if (section === "meta") continue;

    if (section === "member") {
      const [
        ,
        id,
        username,
        password,
        displayName,
        fullName,
        email,
        phone,
        proId,
        role,
        approvalStatus,
        accountStatus,
        referredByProId,
        profilePhotoUrl,
        createdAt,
        lastLoginAt,
      ] = row;

      if (!id?.trim() || !username?.trim() || !password?.trim() || !displayName?.trim()) {
        continue;
      }

      profiles.push({
        id: id.trim(),
        username: username.trim(),
        password: password.trim(),
        displayName: displayName.trim(),
        fullName: fullName?.trim() || displayName.trim(),
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
        proId: proId?.trim() || undefined,
        role: role?.trim() || undefined,
        approvalStatus:
          approvalStatus === "pending" || approvalStatus === "denied" ? approvalStatus : "approved",
        accountStatus: accountStatus === "suspended" ? "suspended" : "active",
        referredByProId: referredByProId?.trim() || undefined,
        profilePhotoUrl: profilePhotoUrl?.trim() || undefined,
        createdAt: createdAt?.trim() || new Date().toISOString(),
        lastLoginAt: lastLoginAt?.trim() || new Date().toISOString(),
      });
      continue;
    }

    if (section === "pool") {
      try {
        poolPayload = {
          poolSummary: JSON.parse(row[1] ?? "{}"),
          poolComposition: JSON.parse(row[2] ?? "[]"),
          dailyAllocationSummary: JSON.parse(row[3] ?? "{}"),
        };
      } catch {
        return { ok: false, error: "Invalid pool data in CSV." };
      }
      continue;
    }

    if (section === "record") {
      const [, binKey, recordId, source, , , payloadJson] = row;
      if (!binKey || !recordId || !source) continue;
      if (!DATA_BIN_DEFINITIONS.some((definition) => definition.key === binKey)) continue;

      try {
        records.push({
          binKey: binKey as DataBinKey,
          recordId: recordId.trim(),
          source: source.trim(),
          payload: JSON.parse(payloadJson ?? "{}") as Record<string, unknown>,
        });
      } catch {
        return { ok: false, error: `Invalid record payload for ${recordId}.` };
      }
    }
  }

  if (!profiles.length && !records.length && !poolPayload) {
    return { ok: false, error: "No importable dashboard data found in CSV." };
  }

  if (profiles.length) {
    replaceAllDadProfiles(profiles);
  }

  for (const definition of DATA_BIN_DEFINITIONS) {
    writeDataBin(definition.key, {
      version: 1,
      binKey: definition.key,
      updatedAt: new Date().toISOString(),
      records: [],
    });
  }

  records.forEach((record) => {
    upsertDataRecord(record.binKey, record.recordId, record.source, record.payload);
  });

  if (poolPayload) {
    importPoolLiveState(poolPayload);
  }

  return { ok: true };
}
