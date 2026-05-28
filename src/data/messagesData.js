export const MESSAGE_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "projects", label: "Projects" },
];

/**
 * @typedef {{
 *   id: string;
 *   senderId: string;
 *   senderName: string;
 *   text: string;
 *   time: string;
 *   isSelf: boolean;
 * }} ChatMessage
 */

/**
 * @typedef {{
 *   id: string;
 *   type: "direct" | "project";
 *   name: string;
 *   initials: string;
 *   color: string;
 *   avatarUrl?: string;
 *   project?: string;
 *   projectColor?: string;
 *   lastMessage: string;
 *   time: string;
 *   unread: number;
 *   messages: ChatMessage[];
 * }} Conversation
 */

/** @type {Conversation[]} */
export const MOCK_CONVERSATIONS = [
  {
    id: "crm-channel",
    type: "project",
    name: "CRM System",
    initials: "CRM",
    color: "#6366f1",
    project: "CRM System",
    projectColor: "#6366f1",
    lastMessage: "Sarah: Wireframes are ready for review",
    time: "2m ago",
    unread: 3,
    messages: [
      {
        id: "m1",
        senderId: "sarah",
        senderName: "Sarah Chen",
        text: "Hey Enis — I uploaded the updated dashboard wireframes to Figma.",
        time: "9:41 AM",
        isSelf: false,
      },
      {
        id: "m2",
        senderId: "enis",
        senderName: "Enis",
        text: "Perfect, I'll review them before standup.",
        time: "9:44 AM",
        isSelf: true,
      },
      {
        id: "m3",
        senderId: "marcus",
        senderName: "Marcus Lee",
        text: "API endpoints for lead scoring are deployed to staging.",
        time: "10:02 AM",
        isSelf: false,
      },
      {
        id: "m4",
        senderId: "sarah",
        senderName: "Sarah Chen",
        text: "Wireframes are ready for review — left comments on the analytics cards.",
        time: "10:18 AM",
        isSelf: false,
      },
    ],
  },
  {
    id: "sarah",
    type: "direct",
    name: "Sarah Chen",
    initials: "SC",
    color: "#8b5cf6",
    project: "CRM System",
    projectColor: "#6366f1",
    lastMessage: "Can we sync on the onboarding flow?",
    time: "18m ago",
    unread: 1,
    messages: [
      {
        id: "m1",
        senderId: "sarah",
        senderName: "Sarah Chen",
        text: "Can we sync on the onboarding flow this afternoon?",
        time: "Yesterday",
        isSelf: false,
      },
      {
        id: "m2",
        senderId: "enis",
        senderName: "Enis",
        text: "Yes — 2pm works for me.",
        time: "Yesterday",
        isSelf: true,
      },
      {
        id: "m3",
        senderId: "sarah",
        senderName: "Sarah Chen",
        text: "Can we sync on the onboarding flow?",
        time: "9:12 AM",
        isSelf: false,
      },
    ],
  },
  {
    id: "marcus",
    type: "direct",
    name: "Marcus Lee",
    initials: "ML",
    color: "#3b82f6",
    project: "CRM System",
    projectColor: "#6366f1",
    lastMessage: "Staging build passed all tests",
    time: "1h ago",
    unread: 0,
    messages: [
      {
        id: "m1",
        senderId: "marcus",
        senderName: "Marcus Lee",
        text: "Staging build passed all tests. Ready when you are.",
        time: "8:30 AM",
        isSelf: false,
      },
      {
        id: "m2",
        senderId: "enis",
        senderName: "Enis",
        text: "Great work — let's ship to QA after lunch.",
        time: "8:45 AM",
        isSelf: true,
      },
    ],
  },
  {
    id: "mobile-channel",
    type: "project",
    name: "Mobile App",
    initials: "MA",
    color: "#f59e0b",
    project: "Mobile App",
    projectColor: "#f59e0b",
    lastMessage: "Elena: Onboarding prototype linked",
    time: "3h ago",
    unread: 0,
    messages: [
      {
        id: "m1",
        senderId: "elena",
        senderName: "Elena Rossi",
        text: "Onboarding prototype is linked in the project brief.",
        time: "Mon",
        isSelf: false,
      },
      {
        id: "m2",
        senderId: "enis",
        senderName: "Enis",
        text: "Thanks Elena — reviewing tonight.",
        time: "Mon",
        isSelf: true,
      },
    ],
  },
  {
    id: "david",
    type: "direct",
    name: "David Kim",
    initials: "DK",
    color: "#64748b",
    project: "Finance Integration",
    projectColor: "#06b6d4",
    lastMessage: "Finance webhook docs updated",
    time: "Yesterday",
    unread: 0,
    messages: [
      {
        id: "m1",
        senderId: "david",
        senderName: "David Kim",
        text: "Finance webhook docs are updated in the repo README.",
        time: "Yesterday",
        isSelf: false,
      },
    ],
  },
  {
    id: "analytics-channel",
    type: "project",
    name: "Analytics Dashboard",
    initials: "AD",
    color: "#10b981",
    project: "Analytics Dashboard",
    projectColor: "#10b981",
    lastMessage: "James: Phase 2 KPI draft attached",
    time: "Tue",
    unread: 2,
    messages: [
      {
        id: "m1",
        senderId: "james",
        senderName: "James Wu",
        text: "Phase 2 KPI draft is attached — let me know what to adjust.",
        time: "Tue",
        isSelf: false,
      },
    ],
  },
];

export const CURRENT_USER = {
  id: "enis",
  name: "Enis",
  avatarUrl: "/profile-enis.png",
};
