import {
  getDadProfilesForBackup,
  replaceAllDadProfiles,
  type DadProfile,
} from "./dadProfileStorage";
import { DATA_BIN_DEFINITIONS, type DataBinKey } from "./dataBins";
import {
  flushInternalDatabase,
  getDatabaseSnapshot,
  writeDataBin,
  type DataBinDocument,
  type StoredRecord,
} from "./internalDatabase";
import { getPoolState, hydratePoolStateFromStorage, importPoolLiveState } from "./poolState";

const CSV_VERSION = "2";

export type DashboardCsvImportResult =
  | {
      ok: true;
      profileCount: number;
      recordCount: number;
      restoredPool: boolean;
    }
  | { ok: false; error: string };

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsv(cells: string[]): string {
  return cells.map((cell) => escapeCsvCell(cell ?? "")).join(",");
}

/** RFC4180-ish parser — keeps newlines inside quoted fields. */
function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
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
      continue;
    }
    if (char === ",") {
      row.push(current);
      current = "";
      continue;
    }
    if (char === "\n") {
      row.push(current);
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }
    if (char === "\r") continue;
    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  return rows;
}

/** Encode JSON so commas/quotes/newlines cannot break CSV columns. */
function encodeJsonCell(value: unknown): string {
  const json = JSON.stringify(value ?? null);
  if (typeof btoa === "function") {
    const bytes = new TextEncoder().encode(json);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return `b64:${btoa(binary)}`;
  }
  return json;
}

function decodeJsonCell(cell: string): unknown {
  const raw = String(cell ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("b64:")) {
    const binary = atob(raw.slice(4));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  return JSON.parse(raw);
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
    // Photos are huge data-URLs — keep CSV lean; cloud/profile photo can re-sync separately.
    "",
    profile.createdAt,
    profile.lastLoginAt,
    profile.accountNumber ?? "",
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
      "accountNumber",
    ]),
  );
  lines.push(
    rowToCsv(["meta", "version", CSV_VERSION, "exportedAt", new Date().toISOString()]),
  );

  // Unfiltered directory — blank/factory-zero lock must not shrink the backup.
  getDadProfilesForBackup().forEach((profile) => {
    lines.push(rowToCsv(profileToRow(profile)));
  });

  const pool = getPoolState();
  lines.push(
    rowToCsv([
      "pool",
      encodeJsonCell(pool.poolSummary),
      encodeJsonCell(pool.poolComposition),
      encodeJsonCell(pool.dailyAllocationSummary),
      encodeJsonCell(pool.poolBalanceHistory ?? {}),
      encodeJsonCell(pool.todaysDonations ?? []),
      encodeJsonCell(pool.allocationComparisons ?? []),
      encodeJsonCell(pool.currentMember ?? null),
      String(pool.activeEasternDay ?? ""),
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
          encodeJsonCell(record.payload),
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
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function unlockPlatformForCsvRestore(): Promise<void> {
  const {
    clearFactoryZeroDeliveryLock,
    clearCloudPlatformBlank,
    pauseCloudPushes,
  } = await import("./supabase/cloudSync");
  const { clearFactoryZeroDisk } = await import("./internalDatabase");

  // Blank/factory-zero locks strip members on write and block disk restores (HTTP 423).
  clearFactoryZeroDeliveryLock();
  pauseCloudPushes(0);
  await clearFactoryZeroDisk();
  await clearCloudPlatformBlank();
}

async function publishRestoredDashboard(profiles: DadProfile[]): Promise<void> {
  try {
    const {
      persistMembersToCloud,
      pushCloudBinsNow,
      publishWorkspaceEpoch,
      markCloudAuthorityReady,
      adoptOpenPlatformFromCloud,
      pauseCloudPushes,
    } = await import("./supabase/cloudSync");
    const snapshot = getDatabaseSnapshot();

    // Opens platform blank lock and force-publishes members so reload cannot wipe restore.
    await persistMembersToCloud(profiles, { openPlatform: true });

    await pushCloudBinsNow(
      DATA_BIN_DEFINITIONS.map((definition) => ({
        binId: definition.binId,
        document: snapshot.bins[definition.key],
      })),
      { force: true },
    );

    // Bump epoch so other devices treat pre-restore caches as obsolete on next login.
    const epoch = await publishWorkspaceEpoch();
    adoptOpenPlatformFromCloud(epoch);
    markCloudAuthorityReady();
    pauseCloudPushes(0);
  } catch (err) {
    console.warn("[dashboardCsv] Cloud publish after restore failed:", err);
  }
}

export async function importDashboardCsv(text: string): Promise<DashboardCsvImportResult> {
  const rows = parseCsv(text);
  if (!rows.length) {
    return { ok: false, error: "CSV file is empty." };
  }

  const profiles: DadProfile[] = [];
  let poolPayload: Partial<ReturnType<typeof getPoolState>> | null = null;
  const recordsByBin = new Map<DataBinKey, StoredRecord[]>();

  for (const row of rows) {
    const section = row[0]?.trim();
    if (!section || section === "section" || section === "meta") continue;

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
        accountNumber,
      ] = row;

      if (!id?.trim() || !username?.trim() || !displayName?.trim()) {
        continue;
      }
      // Password may be hashed or plain — required for login restore.
      if (!password?.trim()) {
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
        accountNumber: accountNumber?.trim() || undefined,
      });
      continue;
    }

    if (section === "pool") {
      try {
        poolPayload = {
          poolSummary: decodeJsonCell(row[1] ?? "") as ReturnType<typeof getPoolState>["poolSummary"],
          poolComposition: decodeJsonCell(row[2] ?? "[]") as ReturnType<
            typeof getPoolState
          >["poolComposition"],
          dailyAllocationSummary: decodeJsonCell(row[3] ?? "{}") as ReturnType<
            typeof getPoolState
          >["dailyAllocationSummary"],
        };
        if (row[4]) {
          poolPayload.poolBalanceHistory = decodeJsonCell(row[4]) as ReturnType<
            typeof getPoolState
          >["poolBalanceHistory"];
        }
        if (row[5]) {
          poolPayload.todaysDonations = decodeJsonCell(row[5]) as ReturnType<
            typeof getPoolState
          >["todaysDonations"];
        }
        if (row[6]) {
          poolPayload.allocationComparisons = decodeJsonCell(row[6]) as ReturnType<
            typeof getPoolState
          >["allocationComparisons"];
        }
        if (row[7]) {
          poolPayload.currentMember = decodeJsonCell(row[7]) as ReturnType<
            typeof getPoolState
          >["currentMember"];
        }
        if (row[8]?.trim()) {
          poolPayload.activeEasternDay = row[8].trim();
        }
      } catch {
        return { ok: false, error: "Invalid pool data in CSV." };
      }
      continue;
    }

    if (section === "record") {
      const [, binKey, recordId, source, createdAt, updatedAt, payloadCell] = row;
      if (!binKey || !recordId || !source) continue;
      if (!DATA_BIN_DEFINITIONS.some((definition) => definition.key === binKey)) continue;

      try {
        const payload = decodeJsonCell(payloadCell ?? "{}") as Record<string, unknown>;
        const list = recordsByBin.get(binKey as DataBinKey) ?? [];
        list.push({
          id: recordId.trim(),
          source: source.trim(),
          createdAt: createdAt?.trim() || new Date().toISOString(),
          updatedAt: updatedAt?.trim() || new Date().toISOString(),
          payload: payload && typeof payload === "object" ? payload : {},
        });
        recordsByBin.set(binKey as DataBinKey, list);
      } catch {
        return { ok: false, error: `Invalid record payload for ${recordId}.` };
      }
    }
  }

  const recordCount = [...recordsByBin.values()].reduce((sum, list) => sum + list.length, 0);
  if (!profiles.length && !recordCount && !poolPayload) {
    return { ok: false, error: "No importable dashboard data found in CSV." };
  }

  await unlockPlatformForCsvRestore();

  if (profiles.length) {
    replaceAllDadProfiles(profiles);
  }

  // Replace each bin atomically (do not merge with stale local rows).
  const stamp = new Date().toISOString();
  for (const definition of DATA_BIN_DEFINITIONS) {
    const records = recordsByBin.get(definition.key) ?? [];
    const document: DataBinDocument = {
      version: 1,
      binKey: definition.key,
      updatedAt: stamp,
      records,
    };
    writeDataBin(definition.key, document);
  }

  if (poolPayload) {
    importPoolLiveState(poolPayload);
  }

  await flushInternalDatabase();

  try {
    const { invalidateMemberAccountsCache } = await import("./memberAccounts");
    invalidateMemberAccountsCache();
  } catch {
    /* ignore */
  }

  try {
    const { syncAllProfilesToMemberRegistry } = await import("./profileRegistry");
    syncAllProfilesToMemberRegistry();
  } catch {
    /* ignore */
  }

  hydratePoolStateFromStorage({ reconcile: false });

  if (profiles.length) {
    await publishRestoredDashboard(profiles);
  } else {
    await publishRestoredDashboard(getDadProfilesForBackup());
  }

  return {
    ok: true,
    profileCount: profiles.length,
    recordCount,
    restoredPool: Boolean(poolPayload),
  };
}
