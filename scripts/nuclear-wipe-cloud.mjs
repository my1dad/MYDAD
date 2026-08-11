#!/usr/bin/env node
/**
 * Delete ALL non-admin profiles and ALL workspace bins/kv, then seed blank dollaraday.
 * Usage: node scripts/nuclear-wipe-cloud.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) continue;
      const key = match[1].trim();
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const WORKSPACE = "dollaraday";
const BIN_IDS = [
  "dollar-a-day-members",
  "dollar-a-day-community-posts",
  "dollar-a-day-contributions",
  "dollar-a-day-allocations",
  "dollar-a-day-admin-captures",
  "dollar-a-day-settings",
];

const sb = createClient(url, key);
const stamp = new Date().toISOString();

function emptyBin(binKey) {
  return { version: 1, binKey, updatedAt: stamp, records: [] };
}

function zeroSettings() {
  return {
    version: 1,
    binKey: "settings",
    updatedAt: stamp,
    records: [
      {
        id: "pool-live-state",
        createdAt: stamp,
        updatedAt: stamp,
        source: "nuclear-wipe",
        payload: {
          poolSummary: {
            totalBalance: 0,
            escrowBalance: 0,
            availableToDeploy: 0,
            deployedCapital: 0,
            memberCount: 1,
            dailyInflow: 0,
            monthlyInflow: 0,
            poolApy: 0,
            lastAudit: "",
            reserveRatio: 0,
            ytdGrowthPct: 0,
          },
          poolComposition: [
            { key: "deployed", name: "Deployed", value: 0, color: "#86efac" },
            { key: "escrow", name: "Escrow", value: 0, color: "#38bdf8" },
            { key: "available", name: "Available", value: 0, color: "#a78bfa" },
          ],
          poolBalanceHistory: {
            "1d": [{ label: "Now", balance: 0 }],
            "1w": [{ label: "Today", balance: 0 }],
            "1m": [{ label: "Start", balance: 0 }],
            "1y": [{ label: "Start", balance: 0 }],
          },
          dailyAllocationSummary: {
            dateLabel: "",
            lastUpdated: "",
            lastUpdatedAt: stamp,
            totalDonations: 0,
            totalAmount: 0,
            averageDonation: 0,
            largestDonation: 0,
          },
          todaysDonations: [],
          allocationComparisons: [],
          currentMember: {
            id: "guest",
            name: "Guest",
            handle: "@guest",
            avatarInitials: "?",
            tier: "Member",
            memberSince: "",
            dailyContribution: 0,
            totalContributed: 0,
            equityValue: 0,
            streakDays: 0,
            loanEligibilityScore: 0,
            loanStatus: "pending",
            nextContributionDue: "—",
          },
          activeEasternDay: stamp.slice(0, 10),
        },
      },
    ],
  };
}

console.log("NUCLEAR WIPE", stamp);

const { data: profiles, error: profileErr } = await sb.from("dad_profiles").select("*");
if (profileErr) throw profileErr;
const admin = (profiles || []).find((row) => String(row.username || "").toLowerCase() === "admin");
if (!admin) throw new Error("Master admin missing — aborting");

const staleIds = (profiles || []).map((row) => row.id).filter((id) => id !== admin.id);
console.log("deleting profiles:", staleIds.length);
for (let i = 0; i < staleIds.length; i += 100) {
  const chunk = staleIds.slice(i, i + 100);
  const { error } = await sb.from("dad_profiles").delete().in("id", chunk);
  if (error) throw error;
}

// Delete EVERY bin row in EVERY workspace (my-dollar-a-day leftovers, etc.).
const { data: allBins, error: binsReadErr } = await sb.from("dad_bins").select("workspace_id,bin_id");
if (binsReadErr) throw binsReadErr;
console.log("deleting bin rows:", (allBins || []).length);
for (const row of allBins || []) {
  const { error } = await sb
    .from("dad_bins")
    .delete()
    .eq("workspace_id", row.workspace_id)
    .eq("bin_id", row.bin_id);
  if (error) throw error;
}

// Delete ALL kv rows in every workspace.
const { data: allKv, error: kvReadErr } = await sb.from("dad_kv").select("workspace_id,scope_key,kv_key");
if (kvReadErr) throw kvReadErr;
console.log("deleting kv rows:", (allKv || []).length);
for (const row of allKv || []) {
  const { error } = await sb
    .from("dad_kv")
    .delete()
    .eq("workspace_id", row.workspace_id)
    .eq("scope_key", row.scope_key)
    .eq("kv_key", row.kv_key);
  if (error) throw error;
}

// Reseed blank dollaraday workspace only.
for (const binId of BIN_IDS) {
  const binKey = binId.replace("dollar-a-day-", "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const keyMap = {
    "dollar-a-day-members": "members",
    "dollar-a-day-community-posts": "communityPosts",
    "dollar-a-day-contributions": "contributions",
    "dollar-a-day-allocations": "allocations",
    "dollar-a-day-admin-captures": "adminCaptures",
    "dollar-a-day-settings": "settings",
  };
  const document = binId === "dollar-a-day-settings" ? zeroSettings() : emptyBin(keyMap[binId]);
  const { error } = await sb.from("dad_bins").upsert(
    { workspace_id: WORKSPACE, bin_id: binId, document, updated_at: stamp },
    { onConflict: "workspace_id,bin_id" },
  );
  if (error) throw error;
}

await sb.from("dad_profiles").upsert(
  {
    ...admin,
    username: "admin",
    role: admin.role || "Master Admin",
    approval_status: "approved",
    account_status: "active",
    updated_at: stamp,
  },
  { onConflict: "id" },
);

await sb.from("dad_kv").upsert(
  [
    {
      workspace_id: WORKSPACE,
      scope_key: "global",
      kv_key: "dollar-a-day-workspace-epoch",
      value: stamp,
      updated_at: stamp,
    },
    {
      workspace_id: WORKSPACE,
      scope_key: "global",
      kv_key: "dollar-a-day-platform-blank",
      value: "1",
      updated_at: stamp,
    },
  ],
  { onConflict: "workspace_id,scope_key,kv_key" },
);

const { data: leftProfiles } = await sb.from("dad_profiles").select("username");
const { data: leftBins } = await sb.from("dad_bins").select("workspace_id,bin_id,document");
const { data: leftKv } = await sb.from("dad_kv").select("workspace_id,kv_key,value");

console.log(
  JSON.stringify(
    {
      profiles: leftProfiles,
      bins: (leftBins || []).map((b) => ({
        ws: b.workspace_id,
        id: b.bin_id,
        n: b.document?.records?.length ?? 0,
      })),
      kv: leftKv,
    },
    null,
    2,
  ),
);

const ok =
  (leftProfiles || []).length === 1 &&
  String(leftProfiles[0]?.username || "").toLowerCase() === "admin" &&
  (leftBins || []).every((b) => b.workspace_id === WORKSPACE) &&
  (leftBins || []).every((b) => (b.bin_id === "dollar-a-day-settings" ? (b.document?.records?.length ?? 0) === 1 : (b.document?.records?.length ?? 0) === 0));

if (!ok) {
  console.error("NUCLEAR WIPE FAILED VERIFICATION");
  process.exit(2);
}
console.log("\nNUCLEAR WIPE COMPLETE — admin only, blank lock on, no other workspaces");
