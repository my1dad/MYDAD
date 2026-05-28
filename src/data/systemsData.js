export const SYSTEM_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "operational", label: "Operational" },
  { id: "degraded", label: "Degraded" },
  { id: "maintenance", label: "Maintenance" },
];

export const SYSTEM_CATEGORY_FILTERS = [
  { id: "all", label: "All types" },
  { id: "integration", label: "Integrations" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "automation", label: "Automations" },
];

/** @typedef {"operational" | "degraded" | "maintenance"} SystemStatus */

/** @typedef {"integration" | "infrastructure" | "automation"} SystemCategory */

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   description: string;
 *   category: SystemCategory;
 *   status: SystemStatus;
 *   uptime: string;
 *   lastSync: string;
 *   project?: string;
 *   projectColor?: string;
 *   version: string;
 * }} ConnectedSystem
 */

/** @type {ConnectedSystem[]} */
export const CONNECTED_SYSTEMS = [
  {
    id: "crm-core",
    name: "CRM Core API",
    description: "Customer records, pipeline stages, and lead routing.",
    category: "integration",
    status: "operational",
    uptime: "99.98%",
    lastSync: "2 min ago",
    project: "CRM System",
    projectColor: "#6366f1",
    version: "v2.14.0",
  },
  {
    id: "inventory-sync",
    name: "Inventory Sync",
    description: "Warehouse stock levels and SKU availability webhooks.",
    category: "integration",
    status: "operational",
    uptime: "99.91%",
    lastSync: "5 min ago",
    project: "Inventory Management",
    projectColor: "#3b82f6",
    version: "v1.8.2",
  },
  {
    id: "lead-automation",
    name: "Lead Automation Engine",
    description: "Email sequences, scoring rules, and nurture workflows.",
    category: "automation",
    status: "degraded",
    uptime: "98.40%",
    lastSync: "18 min ago",
    project: "Lead Automation",
    projectColor: "#8b5cf6",
    version: "v3.1.0",
  },
  {
    id: "analytics-pipeline",
    name: "Analytics Pipeline",
    description: "Event ingestion, dashboards, and KPI aggregation.",
    category: "infrastructure",
    status: "operational",
    uptime: "99.95%",
    lastSync: "1 min ago",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
    version: "v4.0.3",
  },
  {
    id: "finance-gateway",
    name: "Finance Gateway",
    description: "Payment rails, invoicing hooks, and ledger reconciliation.",
    category: "integration",
    status: "maintenance",
    uptime: "—",
    lastSync: "Scheduled 11:00 PM",
    project: "Finance Integration",
    projectColor: "#06b6d4",
    version: "v1.2.5",
  },
  {
    id: "mobile-push",
    name: "Mobile Push Service",
    description: "Device tokens, notifications, and deep-link routing.",
    category: "infrastructure",
    status: "operational",
    uptime: "99.89%",
    lastSync: "8 min ago",
    project: "Mobile App",
    projectColor: "#f59e0b",
    version: "v2.0.1",
  },
  {
    id: "roadmap-scheduler",
    name: "Roadmap Scheduler",
    description: "Phase timers, milestone triggers, and portfolio cron jobs.",
    category: "automation",
    status: "operational",
    uptime: "100%",
    lastSync: "Just now",
    version: "v1.0.0",
  },
  {
    id: "auth-identity",
    name: "Identity & Access",
    description: "SSO, session management, and role-based permissions.",
    category: "infrastructure",
    status: "operational",
    uptime: "99.99%",
    lastSync: "4 min ago",
    version: "v5.3.2",
  },
];

export const SYSTEM_STATUS_STYLES = {
  operational: {
    label: "Operational",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  degraded: {
    label: "Degraded",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  maintenance: {
    label: "Maintenance",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
  },
};

/** @type {{ id: string; system: string; message: string; time: string; level: "info" | "warn" | "error" }[]} */
export const SYSTEM_ACTIVITY = [
  {
    id: "a1",
    system: "Lead Automation Engine",
    message: "Webhook retry queue elevated — investigating latency",
    time: "12 min ago",
    level: "warn",
  },
  {
    id: "a2",
    system: "Finance Gateway",
    message: "Maintenance window started for API v1.2.5 rollout",
    time: "45 min ago",
    level: "info",
  },
  {
    id: "a3",
    system: "CRM Core API",
    message: "Deployment v2.14.0 completed successfully",
    time: "2h ago",
    level: "info",
  },
  {
    id: "a4",
    system: "Analytics Pipeline",
    message: "Daily KPI rollup finished — 6 projects processed",
    time: "4h ago",
    level: "info",
  },
];
