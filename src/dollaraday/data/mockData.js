export const currentMember = {
  id: "m-001",
  name: "Jose Miolan",
  handle: "@jose",
  avatarInitials: "JM",
  tier: "Founder",
  memberSince: "2025-06-18",
  dailyContribution: 1,
  totalContributed: 365,
  equityValue: 1248,
  streakDays: 365,
  loanEligibilityScore: 92,
  loanStatus: "eligible",
  nextContributionDue: "Today, 11:59 PM",
};

export const poolSummary = {
  totalBalance: 5_420_830,
  escrowBalance: 1_280_400,
  availableToDeploy: 894_200,
  deployedCapital: 3_246_230,
  memberCount: 8942,
  dailyInflow: 8942,
  monthlyInflow: 268_260,
  poolApy: 4.82,
  lastAudit: "2026-06-01",
  reserveRatio: 0.236,
  ytdGrowthPct: 18.4,
};

export const poolComposition = [
  { key: "deployed", name: "Deployed", value: 3_246_230, color: "#10b981" },
  { key: "escrow", name: "Escrow", value: 1_280_400, color: "#2563eb" },
  { key: "available", name: "Available", value: 894_200, color: "#eab308" },
];

export const poolGrowthTrend = [
  { month: "Jan", balance: 4.05 },
  { month: "Feb", balance: 4.22 },
  { month: "Mar", balance: 4.48 },
  { month: "Apr", balance: 4.71 },
  { month: "May", balance: 5.02 },
  { month: "Jun", balance: 5.42 },
];

export const poolBalanceIntervals = [
  { id: "1d", label: "1 day" },
  { id: "1w", label: "1 week" },
  { id: "1m", label: "1 month" },
  { id: "1y", label: "1 year" },
];

export const poolBalanceHistory = {
  "1d": [
    { label: "12 AM", balance: 5_410_120 },
    { label: "2 AM", balance: 5_410_680 },
    { label: "4 AM", balance: 5_411_240 },
    { label: "6 AM", balance: 5_412_100 },
    { label: "8 AM", balance: 5_413_450 },
    { label: "10 AM", balance: 5_415_200 },
    { label: "12 PM", balance: 5_416_880 },
    { label: "2 PM", balance: 5_418_420 },
    { label: "4 PM", balance: 5_419_760 },
    { label: "6 PM", balance: 5_420_940 },
    { label: "8 PM", balance: 5_421_820 },
    { label: "Now", balance: 5_420_830 },
  ],
  "1w": [
    { label: "Mon", balance: 5_381_400 },
    { label: "Tue", balance: 5_388_920 },
    { label: "Wed", balance: 5_395_180 },
    { label: "Thu", balance: 5_402_640 },
    { label: "Fri", balance: 5_409_110 },
    { label: "Sat", balance: 5_414_880 },
    { label: "Today", balance: 5_420_830 },
  ],
  "1m": [
    { label: "May 14", balance: 5_018_400 },
    { label: "May 18", balance: 5_032_600 },
    { label: "May 22", balance: 5_048_200 },
    { label: "May 26", balance: 5_064_800 },
    { label: "May 30", balance: 5_081_500 },
    { label: "Jun 3", balance: 5_098_200 },
    { label: "Jun 6", balance: 5_112_400 },
    { label: "Jun 8", balance: 5_126_800 },
    { label: "Jun 10", balance: 5_148_600 },
    { label: "Jun 11", balance: 5_286_400 },
    { label: "Jun 12", balance: 5_420_830 },
  ],
  "1y": [
    { label: "Jul", balance: 3_820_000 },
    { label: "Aug", balance: 3_960_000 },
    { label: "Sep", balance: 4_080_000 },
    { label: "Oct", balance: 4_210_000 },
    { label: "Nov", balance: 4_340_000 },
    { label: "Dec", balance: 4_450_000 },
    { label: "Jan", balance: 4_560_000 },
    { label: "Feb", balance: 4_680_000 },
    { label: "Mar", balance: 4_820_000 },
    { label: "Apr", balance: 4_980_000 },
    { label: "May", balance: 5_140_000 },
    { label: "Jun", balance: 5_420_830 },
  ],
};

export const contributionHistory = [
  { date: "Jun 18", amount: 1, status: "completed" },
  { date: "Jun 17", amount: 1, status: "completed" },
  { date: "Jun 16", amount: 1, status: "completed" },
  { date: "Jun 15", amount: 1, status: "completed" },
  { date: "Jun 14", amount: 1, status: "completed" },
  { date: "Jun 13", amount: 1, status: "completed" },
  { date: "Jun 12", amount: 1, status: "completed" },
];

/** Featured members shown on dashboard */
export const featuredMembers = [
  { id: "m-001", name: "Jose Miolan", days: 365, contributed: 365, equity: 1248, score: 92 },
  { id: "m-002", name: "Natasha Perez", handle: "@natti", days: 214, contributed: 214, equity: 642, score: 81 },
  { id: "m-003", name: "David Chen", days: 128, contributed: 128, equity: 301, score: 74 },
];

export const members = [
  ...featuredMembers.map((m) => ({
    id: m.id,
    name: m.name,
    handle: m.handle ?? `@${m.name.split(" ")[0].toLowerCase()}`,
    tier: m.score >= 90 ? "Founder" : m.score >= 80 ? "Builder" : "Member",
    contributed: m.contributed,
    equity: m.equity,
    days: m.days,
    score: m.score,
    streak: m.days,
    status: "active",
  })),
  { id: "m-004", name: "Sofia Rivera", handle: "@sofia", tier: "Member", contributed: 210, equity: 488, days: 210, score: 68, streak: 210, status: "active" },
  { id: "m-005", name: "Devon Walsh", handle: "@devon", tier: "Member", contributed: 188, equity: 412, days: 188, score: 55, streak: 0, status: "paused" },
];

export const investmentFunnel = [
  {
    key: "treasury",
    name: "Treasury Bills",
    percent: 65,
    color: "#10b981",
    returnPct: 4.92,
    risk: "Low",
    liquidity: "High",
    description: "Short-duration U.S. government paper with daily liquidity.",
  },
  {
    key: "moneyMarket",
    name: "Money Market",
    percent: 20,
    color: "#2563eb",
    returnPct: 4.68,
    risk: "Low",
    liquidity: "High",
    description: "Institutional money market funds for stable yield.",
  },
  {
    key: "bonds",
    name: "Bonds",
    percent: 10,
    color: "#8b5cf6",
    returnPct: 4.35,
    risk: "Medium",
    liquidity: "Medium",
    description: "Investment-grade municipal and corporate fixed income.",
  },
  {
    key: "cashReserve",
    name: "Cash Reserve",
    percent: 5,
    color: "#eab308",
    returnPct: 3.8,
    risk: "Low",
    liquidity: "Immediate",
    description: "On-demand liquidity buffer for member withdrawals.",
  },
];

export const escrowLedger = [
  { id: "e-1", label: "Member contributions (Jun)", amount: 268_260, type: "inflow" },
  { id: "e-2", label: "Treasury allocation", amount: -3_520_000, type: "outflow" },
  { id: "e-3", label: "Escrow reserve hold", amount: 1_280_400, type: "hold" },
  { id: "e-4", label: "Loan escrow — Natasha Perez", amount: 12_500, type: "hold" },
];

export const investments = investmentFunnel.map((item, index) => ({
  id: `inv-${index + 1}`,
  name: item.name,
  category: "Fixed income",
  percent: item.percent,
  allocated: Math.round((poolSummary.deployedCapital * item.percent) / 100),
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
  "1m": [
    { label: "May 14", apy: 4.71 },
    { label: "May 18", apy: 4.72 },
    { label: "May 22", apy: 4.74 },
    { label: "May 26", apy: 4.75 },
    { label: "May 30", apy: 4.76 },
    { label: "Jun 3", apy: 4.78 },
    { label: "Jun 6", apy: 4.79 },
    { label: "Jun 8", apy: 4.8 },
    { label: "Jun 10", apy: 4.81 },
    { label: "Jun 11", apy: 4.82 },
    { label: "Jun 12", apy: 4.82 },
  ],
  "3m": [
    { label: "Mar", apy: 4.52 },
    { label: "Apr", apy: 4.58 },
    { label: "May", apy: 4.69 },
    { label: "Jun", apy: 4.82 },
  ],
  "1y": [
    { label: "Jul", apy: 3.92 },
    { label: "Aug", apy: 4.01 },
    { label: "Sep", apy: 4.08 },
    { label: "Oct", apy: 4.14 },
    { label: "Nov", apy: 4.22 },
    { label: "Dec", apy: 4.28 },
    { label: "Jan", apy: 4.35 },
    { label: "Feb", apy: 4.44 },
    { label: "Mar", apy: 4.52 },
    { label: "Apr", apy: 4.61 },
    { label: "May", apy: 4.74 },
    { label: "Jun", apy: 4.82 },
  ],
};

export const investmentHighlights = [
  {
    id: "deployed",
    label: "Deployed capital",
    caption: "vs last month",
    previous: 3_118_000,
    current: 3_246_230,
    format: "currency",
  },
  {
    id: "yield",
    label: "Blended APY",
    caption: "vs last quarter",
    previous: 4.61,
    current: 4.82,
    format: "percent",
  },
  {
    id: "income",
    label: "Monthly yield",
    caption: "estimated payout",
    previous: 12_420,
    current: 13_048,
    format: "currency",
  },
  {
    id: "diversification",
    label: "Active sleeves",
    caption: "allocation buckets",
    previous: 4,
    current: 4,
    format: "count",
  },
];

export const allocationChart = investments.map((i) => ({
  name: i.name.split(" ")[0],
  value: i.allocated,
  fill: i.color,
}));

export const loans = [
  { id: "ln-1", member: "Natasha Perez", amount: 12_500, purpose: "Small business float", status: "in_review", score: 81 },
  { id: "ln-2", member: "David Chen", amount: 4_200, purpose: "Equipment upgrade", status: "approved", score: 74 },
  { id: "ln-3", member: "Devon Walsh", amount: 800, purpose: "Bridge capital", status: "declined", score: 52 },
];

export const loanEligibilityFactors = [
  { label: "Contribution streak", score: 98, weight: "30%" },
  { label: "Equity value", score: 92, weight: "25%" },
  { label: "Community standing", score: 88, weight: "20%" },
  { label: "Repayment history", score: 90, weight: "25%" },
];

export const communityPosts = [
  { id: "p-1", author: "Jose Miolan", handle: "@jose", time: "2h ago", body: "Proposal: increase Treasury Bills allocation to 70% for Q3 stability. Vote opens Friday.", likes: 124, replies: 38, pinned: true },
  { id: "p-2", author: "Natasha Perez", handle: "@natti", time: "5h ago", body: "214 days of $1/day — grateful for this community pool and transparent escrow.", likes: 89, replies: 22, pinned: false },
  { id: "p-3", author: "David Chen", handle: "@david", time: "1d ago", body: "Pool APY holding at 4.82%. Escrow audit summary posted in #governance.", likes: 56, replies: 11, pinned: false },
];

/** WhatsApp community chat room — replace inviteUrl with your group link. */
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
  pendingLoans: 3,
  flaggedAccounts: 1,
  escrowAlerts: 0,
  weeklySignups: 412,
  contributionCompliance: 96.8,
  totalDeployed: 3_524_000,
  pendingAllocations: 0,
};

export const dashboardStats = {
  escrow: { label: "Escrow Balance", value: "$1,280,400" },
  daily: { label: "Daily Contributions", value: "$8,942" },
  apy: { label: "Pool APY", value: "4.82%" },
};

export const dailyAllocationSummary = {
  dateLabel: "Friday, June 12, 2026",
  totalDonations: 8942,
  totalAmount: 8942,
  uniqueContributors: 8942,
  pending: 12,
  lastUpdated: "2 min ago",
};

export const allocationComparisons = [
  {
    id: "yesterday",
    label: "Yesterday",
    caption: "Daily donations",
    previous: 8731,
    current: 8942,
    format: "count",
  },
  {
    id: "last-week",
    label: "Last week",
    caption: "7-day daily average",
    previous: 8412,
    current: 8856,
    format: "count",
  },
  {
    id: "last-month",
    label: "Last month",
    caption: "May milestone total",
    previous: 260_180,
    current: 268_260,
    format: "currency",
  },
  {
    id: "milestone",
    label: "9K daily goal",
    caption: "Milestone progress",
    previous: 8500,
    current: 8942,
    target: 9000,
    format: "milestone",
  },
];

export const todaysDonations = [
  { id: "d-001", member: "Jose Miolan", handle: "@jose", amount: 1, time: "12:04 AM", status: "completed" },
  { id: "d-002", member: "Natasha Perez", handle: "@natti", amount: 1, time: "12:11 AM", status: "completed" },
  { id: "d-003", member: "David Chen", handle: "@david", amount: 1, time: "12:18 AM", status: "completed" },
  { id: "d-004", member: "Sofia Rivera", handle: "@sofia", amount: 1, time: "12:26 AM", status: "completed" },
  { id: "d-005", member: "Devon Walsh", handle: "@devon", amount: 1, time: "12:33 AM", status: "pending" },
  { id: "d-006", member: "Alicia Park", handle: "@alicia", amount: 1, time: "12:41 AM", status: "completed" },
  { id: "d-007", member: "Jordan Miles", handle: "@jordan", amount: 1, time: "12:52 AM", status: "completed" },
  { id: "d-008", member: "Priya Nair", handle: "@priya", amount: 1, time: "1:03 AM", status: "completed" },
  { id: "d-009", member: "Marcus Cole", handle: "@marcus", amount: 1, time: "1:14 AM", status: "completed" },
  { id: "d-010", member: "Lena Ortiz", handle: "@lena", amount: 1, time: "1:22 AM", status: "completed" },
  { id: "d-011", member: "Noah Kim", handle: "@noah", amount: 1, time: "1:35 AM", status: "completed" },
  { id: "d-012", member: "Riley Stone", handle: "@riley", amount: 1, time: "1:48 AM", status: "pending" },
  { id: "d-013", member: "Tessa Wong", handle: "@tessa", amount: 1, time: "2:01 AM", status: "completed" },
  { id: "d-014", member: "Chris Alvarez", handle: "@chris", amount: 1, time: "2:16 AM", status: "completed" },
  { id: "d-015", member: "Maya Brooks", handle: "@maya", amount: 1, time: "2:29 AM", status: "completed" },
  { id: "d-016", member: "Omar Haddad", handle: "@omar", amount: 1, time: "2:44 AM", status: "completed" },
  { id: "d-017", member: "Zoe Patel", handle: "@zoe", amount: 1, time: "2:58 AM", status: "completed" },
  { id: "d-018", member: "Ethan Ross", handle: "@ethan", amount: 1, time: "3:12 AM", status: "completed" },
];

export function formatPoolCurrency(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
