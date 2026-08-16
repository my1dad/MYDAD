#!/usr/bin/env node
/**
 * Wipe Supabase workspace to master-admin-only + $0 pool/ledgers.
 * Usage: node scripts/factory-zero-cloud.mjs
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
    /* optional env file */
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
const KEY_BY_ID = {
  "dollar-a-day-members": "members",
  "dollar-a-day-community-posts": "communityPosts",
  "dollar-a-day-contributions": "contributions",
  "dollar-a-day-allocations": "allocations",
  "dollar-a-day-admin-captures": "adminCaptures",
  "dollar-a-day-settings": "settings",
};

const sb = createClient(url, key);

function emptyBin(binKey, stamp) {
  return { version: 1, binKey, updatedAt: stamp, records: [] };
}

function zeroSettings(stamp) {
  return {
    version: 1,
    binKey: "settings",
    updatedAt: stamp,
    records: [
      {
        id: "pool-live-state",
        createdAt: stamp,
        updatedAt: stamp,
        source: "factory-zero-cloud",
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

async function wipeOnce(pass) {
  const stamp = new Date().toISOString();
  console.log(`\n[pass ${pass}] epoch ${stamp}`);

  // Anon RLS only allows workspace_id = 'dollaraday' — foreign workspaces are invisible.
  const { data: profiles, error: profileErr } = await sb
    .from("dad_profiles")
    .select("*")
    .eq("workspace_id", WORKSPACE);
  if (profileErr) throw profileErr;
  const admin = (profiles || []).find((row) => String(row.username || "").toLowerCase() === "admin");
  if (!admin) throw new Error("Master admin profile missing");

  const staleIds = (profiles || []).map((row) => row.id).filter((id) => id !== admin.id);
  for (let i = 0; i < staleIds.length; i += 100) {
    const chunk = staleIds.slice(i, i + 100);
    const { error } = await sb
      .from("dad_profiles")
      .delete()
      .eq("workspace_id", WORKSPACE)
      .in("id", chunk);
    if (error) throw error;
  }

  const { error: upsertAdminErr } = await sb.from("dad_profiles").upsert(
    {
      ...admin,
      workspace_id: WORKSPACE,
      username: "admin",
      role: admin.role || "Master Admin",
      approval_status: "approved",
      account_status: "active",
      updated_at: stamp,
    },
    { onConflict: "id" },
  );
  if (upsertAdminErr) throw upsertAdminErr;

  for (const binId of BIN_IDS) {
    const binKey = KEY_BY_ID[binId];
    const document = binKey === "settings" ? zeroSettings(stamp) : emptyBin(binKey, stamp);
    const { error } = await sb.from("dad_bins").upsert(
      {
        workspace_id: WORKSPACE,
        bin_id: binId,
        document,
        updated_at: stamp,
      },
      { onConflict: "workspace_id,bin_id" },
    );
    if (error) throw error;
  }

  const { data: kvRows, error: kvErr } = await sb
    .from("dad_kv")
    .select("kv_key,scope_key")
    .eq("workspace_id", WORKSPACE);
  if (kvErr) throw kvErr;
  for (const row of kvRows || []) {
    if (row.scope_key === "global" && row.kv_key === "dollar-a-day-workspace-epoch") continue;
    await sb
      .from("dad_kv")
      .delete()
      .eq("workspace_id", WORKSPACE)
      .eq("scope_key", row.scope_key)
      .eq("kv_key", row.kv_key);
  }

  const { error: epochErr } = await sb.from("dad_kv").upsert(
    {
      workspace_id: WORKSPACE,
      scope_key: "global",
      kv_key: "dollar-a-day-workspace-epoch",
      value: stamp,
      updated_at: stamp,
    },
    { onConflict: "workspace_id,scope_key,kv_key" },
  );
  if (epochErr) throw epochErr;

  // Cloud-wide blank lock — every device must stay at $0 until a real member is added.
  const { error: blankErr } = await sb.from("dad_kv").upsert(
    {
      workspace_id: WORKSPACE,
      scope_key: "global",
      kv_key: "dollar-a-day-platform-blank",
      value: "1",
      updated_at: stamp,
    },
    { onConflict: "workspace_id,scope_key,kv_key" },
  );
  if (blankErr) throw blankErr;

  return stamp;
}

async function verify() {
  const { data: profiles } = await sb
    .from("dad_profiles")
    .select("username,role,workspace_id")
    .eq("workspace_id", WORKSPACE);
  const { data: settings } = await sb
    .from("dad_bins")
    .select("document")
    .eq("workspace_id", WORKSPACE)
    .eq("bin_id", "dollar-a-day-settings")
    .maybeSingle();
  const summary = settings?.document?.records?.find((row) => row.id === "pool-live-state")?.payload
    ?.poolSummary;
  const { data: contributions } = await sb
    .from("dad_bins")
    .select("document")
    .eq("workspace_id", WORKSPACE)
    .eq("bin_id", "dollar-a-day-contributions")
    .maybeSingle();
  const { data: members } = await sb
    .from("dad_bins")
    .select("document")
    .eq("workspace_id", WORKSPACE)
    .eq("bin_id", "dollar-a-day-members")
    .maybeSingle();

  const { data: blankRow } = await sb
    .from("dad_kv")
    .select("value")
    .eq("workspace_id", WORKSPACE)
    .eq("scope_key", "global")
    .eq("kv_key", "dollar-a-day-platform-blank")
    .maybeSingle();

  return {
    profiles: profiles || [],
    poolTotal: Number(summary?.totalBalance) || 0,
    poolInflow: Number(summary?.dailyInflow) || 0,
    contributionRecords: contributions?.document?.records?.length ?? -1,
    memberRecords: members?.document?.records?.length ?? -1,
    platformBlank: blankRow?.value === "1" || blankRow?.value === 1 || blankRow?.value === true,
  };
}

const passes = Number(process.env.FACTORY_ZERO_PASSES || 3);
for (let pass = 1; pass <= passes; pass += 1) {
  await wipeOnce(pass);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const state = await verify();
  console.log("verify", state);
  if (
    state.profiles.length === 1 &&
    String(state.profiles[0]?.username || "").toLowerCase() === "admin" &&
    state.poolTotal === 0 &&
    state.poolInflow === 0 &&
    state.contributionRecords === 0 &&
    state.memberRecords === 0 &&
    state.platformBlank
  ) {
    console.log("\nFACTORY ZERO STABLE");
    process.exit(0);
  }
}

const finalState = await verify();
console.error("\nFACTORY ZERO NOT STABLE — another client may still be writing.", finalState);
process.exit(2);
