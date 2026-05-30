import { PROFILE_ENIS_URL } from "../lib/assetUrl";

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
export const MOCK_CONVERSATIONS = [];

export const CURRENT_USER = {
  id: "enis",
  name: "Enis",
  avatarUrl: PROFILE_ENIS_URL,
};
