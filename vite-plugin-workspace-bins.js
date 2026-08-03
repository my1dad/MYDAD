import fs from "node:fs/promises";
import path from "node:path";
import {
  ATTACHMENTS_BIN_DIR,
  BIN_PATH_BY_ID,
  WORKSPACE_BIN_IDS,
} from "./src/lib/binCatalog.js";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function writeJsonFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

function resolveProfileId(url) {
  const profileId = url.searchParams.get("profileId");
  if (!profileId || !/^[a-zA-Z0-9-]+$/.test(profileId)) return null;
  return profileId;
}

function resolveWorkspaceRoot(root, url) {
  const profileId = resolveProfileId(url);
  if (!profileId) return root;
  return path.join(root, "profiles", profileId);
}

function lockPath(workspaceRoot) {
  return path.join(workspaceRoot, "FACTORY_ZERO.lock");
}

async function isFactoryZeroLocked(workspaceRoot) {
  try {
    await fs.access(lockPath(workspaceRoot));
    return true;
  } catch {
    return false;
  }
}

function emptyBin(binKey) {
  const now = new Date().toISOString();
  return { version: 1, binKey, updatedAt: now, records: [] };
}

function zeroSettingsBin() {
  const now = new Date().toISOString();
  return {
    version: 1,
    binKey: "settings",
    updatedAt: now,
    records: [
      {
        id: "pool-live-state",
        createdAt: now,
        updatedAt: now,
        source: "factory-zero",
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
            lastUpdatedAt: now,
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
          activeEasternDay: now.slice(0, 10),
        },
      },
    ],
  };
}

function binKeyFromId(binId) {
  const map = {
    "dollar-a-day-members": "members",
    "dollar-a-day-community-posts": "communityPosts",
    "dollar-a-day-contributions": "contributions",
    "dollar-a-day-allocations": "allocations",
    "dollar-a-day-admin-captures": "adminCaptures",
    "dollar-a-day-settings": "settings",
  };
  return map[binId] ?? "settings";
}

async function writeFactoryZeroWorkspace(workspaceRoot) {
  await fs.mkdir(workspaceRoot, { recursive: true });
  for (const binId of WORKSPACE_BIN_IDS) {
    const rel = BIN_PATH_BY_ID[binId];
    if (!rel) continue;
    const key = binKeyFromId(binId);
    const doc = key === "settings" ? zeroSettingsBin() : emptyBin(key);
    await writeJsonFile(path.join(workspaceRoot, rel), doc);
  }
  await fs.writeFile(
    lockPath(workspaceRoot),
    JSON.stringify({ lockedAt: new Date().toISOString(), reason: "client-delivery-zero" }, null, 2),
    "utf8",
  );
}

function isZeroishPayload(binId, body) {
  if (!body || typeof body !== "object") return false;
  const records = Array.isArray(body.records) ? body.records : [];
  if (binId === "dollar-a-day-settings") {
    // Allow only pool-live-state (or empty). Block member-accounts / recurring / allocations.
    return records.every((record) => {
      const id = String(record?.id ?? "");
      if (id === "pool-live-state") {
        const summary = record?.payload?.poolSummary ?? {};
        const total = Number(summary.totalBalance) || 0;
        const escrow = Number(summary.escrowBalance) || 0;
        const inflow = Number(summary.dailyInflow) || 0;
        return total === 0 && escrow === 0 && inflow === 0;
      }
      return false;
    });
  }
  return records.length === 0;
}

export function workspaceBinsPlugin(binsRoot) {
  const root = path.resolve(binsRoot);

  async function ensureRoot(workspaceRoot) {
    await fs.mkdir(path.join(workspaceRoot, ATTACHMENTS_BIN_DIR), { recursive: true });
    for (const binId of WORKSPACE_BIN_IDS) {
      const rel = BIN_PATH_BY_ID[binId];
      if (rel) await fs.mkdir(path.dirname(path.join(workspaceRoot, rel)), { recursive: true });
    }
  }

  return {
    name: "workspace-bins",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/bins")) return next();

        try {
          const url = new URL(req.url, "http://localhost");
          const pathname = url.pathname;
          const workspaceRoot = resolveWorkspaceRoot(root, url);

          await ensureRoot(workspaceRoot);

          if (req.method === "GET" && pathname === "/api/bins/bootstrap") {
            if (!resolveProfileId(url)) {
              return sendJson(res, 400, { error: "profileId required" });
            }
            const forceFactoryZero = await isFactoryZeroLocked(workspaceRoot);
            const payload = {
              binsRoot: workspaceRoot,
              profileId: resolveProfileId(url),
              forceFactoryZero,
            };
            for (const binId of WORKSPACE_BIN_IDS) {
              const rel = BIN_PATH_BY_ID[binId];
              payload[binId] = rel ? await readJsonFile(path.join(workspaceRoot, rel)) : null;
            }
            return sendJson(res, 200, payload);
          }

          if (req.method === "PUT" && pathname.startsWith("/api/bins/")) {
            if (!resolveProfileId(url)) {
              return sendJson(res, 400, { error: "profileId required" });
            }
            const binId = decodeURIComponent(pathname.slice("/api/bins/".length));
            const rel = BIN_PATH_BY_ID[binId];
            if (!rel) return sendJson(res, 404, { error: "Unknown bin" });
            const body = await readBody(req);

            // While FACTORY_ZERO.lock exists, block the browser from writing old balances back.
            if (await isFactoryZeroLocked(workspaceRoot)) {
              if (!isZeroishPayload(binId, body)) {
                return sendJson(res, 423, {
                  error: "Factory zero lock active — non-zero workspace writes are blocked.",
                  locked: true,
                });
              }
            }

            await writeJsonFile(path.join(workspaceRoot, rel), body);
            return sendJson(res, 200, { ok: true });
          }

          if (req.method === "POST" && pathname === "/api/bins/delete-profile-workspace") {
            if (!resolveProfileId(url)) {
              return sendJson(res, 400, { error: "profileId required" });
            }
            const profileId = resolveProfileId(url);
            const profileRoot = path.join(root, "profiles", profileId);
            await fs.rm(profileRoot, { recursive: true, force: true });
            return sendJson(res, 200, { ok: true });
          }

          if (req.method === "POST" && pathname === "/api/bins/factory-zero") {
            if (!resolveProfileId(url)) {
              return sendJson(res, 400, { error: "profileId required" });
            }
            await writeFactoryZeroWorkspace(workspaceRoot);
            return sendJson(res, 200, { ok: true, forceFactoryZero: true });
          }

          if (req.method === "POST" && pathname === "/api/bins/reset") {
            if (!resolveProfileId(url)) {
              return sendJson(res, 400, { error: "profileId required" });
            }
            await writeFactoryZeroWorkspace(workspaceRoot);
            const attachmentsDir = path.join(workspaceRoot, ATTACHMENTS_BIN_DIR);
            try {
              const entries = await fs.readdir(attachmentsDir);
              await Promise.all(
                entries.map((entry) => fs.unlink(path.join(attachmentsDir, entry))),
              );
            } catch (err) {
              if (err?.code !== "ENOENT") throw err;
            }
            return sendJson(res, 200, { ok: true, forceFactoryZero: true });
          }

          if (req.method === "POST" && pathname === "/api/bins/attachments") {
            const body = await readBody(req);
            const relativePath = body.relativePath;
            const dataUrl = body.dataUrl;
            if (!relativePath || !dataUrl) {
              return sendJson(res, 400, { error: "Missing attachment payload" });
            }
            const comma = dataUrl.indexOf(",");
            const meta = comma >= 0 ? dataUrl.slice(0, comma) : "";
            const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
            const buffer = Buffer.from(base64, "base64");
            const filePath = path.join(root, relativePath);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, buffer);
            const sidecar = `${filePath}.meta.json`;
            await fs.writeFile(
              sidecar,
              JSON.stringify({ mime: meta.replace(/^data:/, "").replace(/;base64$/, "") }),
              "utf8",
            );
            return sendJson(res, 200, { relativePath });
          }

          if (req.method === "GET" && pathname.startsWith("/api/bins/attachments/")) {
            const relativePath = decodeURIComponent(pathname.slice("/api/bins/attachments/".length));
            const filePath = path.join(root, relativePath);
            const sidecar = `${filePath}.meta.json`;
            const buffer = await fs.readFile(filePath);
            let mime = "application/octet-stream";
            try {
              const meta = JSON.parse(await fs.readFile(sidecar, "utf8"));
              if (meta?.mime) mime = meta.mime;
            } catch {
              // optional sidecar
            }
            const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
            return sendJson(res, 200, { dataUrl, relativePath });
          }

          return sendJson(res, 404, { error: "Not found" });
        } catch (err) {
          console.error("[workspace-bins]", err);
          return sendJson(res, 500, { error: err?.message ?? "Server error" });
        }
      });
    },
  };
}
