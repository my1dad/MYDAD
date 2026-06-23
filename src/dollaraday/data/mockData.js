import { DDA_THEME } from "../lib/theme.js";

/** Empty guest profile — replaced when a member signs in. */
export const currentMember = {
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
};

export const poolSummary = {
  totalBalance: 0,
  escrowBalance: 0,
  availableToDeploy: 0,
  deployedCapital: 0,
  memberCount: 0,
  dailyInflow: 0,
  monthlyInflow: 0,
  poolApy: 0,
  lastAudit: "",
  reserveRatio: 0,
  ytdGrowthPct: 0,
};

export const poolComposition = [
  { key: "deployed", name: "Deployed", value: 0, color: DDA_THEME.green },
  { key: "escrow", name: "Escrow", value: 0, color: DDA_THEME.greenLight },
  { key: "available", name: "Available", value: 0, color: DDA_THEME.goldLight },
];

export const poolGrowthTrend = [];

export const poolBalanceIntervals = [
  { id: "1d", label: "1 day" },
  { id: "1w", label: "1 week" },
  { id: "1m", label: "1 month" },
  { id: "1y", label: "1 year" },
];

export const poolBalanceHistory = {
  "1d": [{ label: "Now", balance: 0 }],
  "1w": [{ label: "Today", balance: 0 }],
  "1m": [{ label: "Start", balance: 0 }],
  "1y": [{ label: "Start", balance: 0 }],
};

export const contributionHistory = [];

export const featuredMembers = [];

export const members = [];

export const investmentFunnel = [
  {
    key: "treasury",
    name: "Treasury Bills",
    percent: 0,
    color: DDA_THEME.green,
    returnPct: 0,
    risk: "Low",
    liquidity: "High",
    description: "Short-duration U.S. government paper with daily liquidity.",
  },
  {
    key: "moneyMarket",
    name: "Money Market",
    percent: 0,
    color: DDA_THEME.greenLight,
    returnPct: 0,
    risk: "Low",
    liquidity: "High",
    description: "Institutional money market funds for stable yield.",
  },
  {
    key: "bonds",
    name: "Bonds",
    percent: 0,
    color: "#8b5cf6",
    returnPct: 0,
    risk: "Medium",
    liquidity: "Medium",
    description: "Investment-grade municipal and corporate fixed income.",
  },
  {
    key: "cashReserve",
    name: "Cash Reserve",
    percent: 0,
    color: DDA_THEME.goldLight,
    returnPct: 0,
    risk: "Low",
    liquidity: "Immediate",
    description: "On-demand liquidity buffer for member withdrawals.",
  },
];

export const escrowLedger = [];

export const investments = investmentFunnel.map((item, index) => ({
  id: `inv-${index + 1}`,
  name: item.name,
  category: "Fixed income",
  percent: item.percent,
  allocated: 0,
  returnPct: item.returnPct,
  status: "active",
  color: item.color,
  risk: item.risk,
  liquidity: item.liquidity,
  description: item.description,
}));

export const investmentIntervals = [
  { id: "1m", label: "1 month" },
  { id: "3m", label: "3 months" },
  { id: "1y", label: "1 year" },
];

export const investmentYieldHistory = {
  "1m": [{ label: "Start", apy: 0 }],
  "3m": [{ label: "Start", apy: 0 }],
  "1y": [{ label: "Start", apy: 0 }],
};

export const investmentHighlights = [
  {
    id: "deployed",
    label: "Deployed capital",
    caption: "vs last month",
    previous: 0,
    current: 0,
    format: "currency",
  },
  {
    id: "yield",
    label: "Blended APY",
    caption: "vs last quarter",
    previous: 0,
    current: 0,
    format: "percent",
  },
  {
    id: "income",
    label: "Monthly yield",
    caption: "estimated payout",
    previous: 0,
    current: 0,
    format: "currency",
  },
  {
    id: "diversification",
    label: "Active sleeves",
    caption: "allocation buckets",
    previous: 0,
    current: 0,
    format: "count",
  },
];

export const allocationChart = investments.map((i) => ({
  name: i.name.split(" ")[0],
  value: i.allocated,
  fill: i.color,
}));

export const loans = [];

export const loanEligibilityFactors = [
  { label: "Contribution streak", score: 0, weight: "30%" },
  { label: "Equity value", score: 0, weight: "25%" },
  { label: "Community standing", score: 0, weight: "20%" },
  { label: "Repayment history", score: 0, weight: "25%" },
];

export const communityPosts = [];

export const communityChatRoom = {
  label: "Open chat room",
  inviteUrl: "https://chat.whatsapp.com/invite",
};

export const communityChannels = [
  { id: "governance", label: "Governance", desc: "Proposals, votes, and pool policy" },
  { id: "investing", label: "Investing", desc: "Allocation ideas and yield discussion" },
  { id: "announcements", label: "Announcements", desc: "Official updates from the pool" },
  { id: "support", label: "Support", desc: "Help, questions, and member guidance" },
];

export const featureCards = [
  {
    id: "pool",
    title: "Liquidity Pool",
    desc: "Track all member contributions, escrow balance, pool growth, and reserves.",
    page: "pool",
  },
  {
    id: "loans",
    title: "Loan Eligibility",
    desc: "Calculate borrowing power using loyalty, contribution history, and equity.",
    page: "loans",
  },
  {
    id: "community",
    title: "Community Board",
    desc: "Discord-style channels for governance, investing, announcements, and support.",
    page: "community",
  },
];

export const adminOverview = {
  pendingLoans: 0,
  flaggedAccounts: 0,
  escrowAlerts: 0,
  weeklySignups: 0,
  contributionCompliance: 0,
  totalDeployed: 0,
  pendingAllocations: 0,
};

export const dashboardStats = {
  escrow: { label: "Escrow Balance", value: "$0" },
  daily: { label: "Daily Contributions", value: "$0" },
  apy: { label: "Pool APY", value: "0%" },
};

export const dailyAllocationSummary = {
  dateLabel: "",
  totalDonations: 0,
  totalAmount: 0,
  uniqueContributors: 0,
  pending: 0,
  lastUpdated: "—",
};

export const allocationComparisons = [
  {
    id: "yesterday",
    label: "Yesterday",
    caption: "Daily donations",
    previous: 0,
    current: 0,
    format: "count",
  },
  {
    id: "last-week",
    label: "Last week",
    caption: "7-day daily average",
    previous: 0,
    current: 0,
    format: "count",
  },
  {
    id: "last-month",
    label: "Last month",
    caption: "Monthly total",
    previous: 0,
    current: 0,
    format: "currency",
  },
  {
    id: "milestone",
    label: "Daily goal",
    caption: "Milestone progress",
    previous: 0,
    current: 0,
    target: 0,
    format: "milestone",
  },
];

export const todaysDonations = [];

export function formatPoolCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
