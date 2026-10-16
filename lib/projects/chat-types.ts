import type { UIMessage } from "ai";

export type ChatMetadata = {
  /** Set on the first answer of a new chat, so the browser knows which chat it is in. */
  threadId?: string;
  /** Sent with each finished answer, and saved with it. */
  usage?: { inputTokens: number; outputTokens: number; model: string };
};

export type ProjectChatMessage = UIMessage<ChatMetadata>;

/**
 * Token budget for each reply (see .claude/knowledge/less-token-usage.md):
 * the project memory plus this chat's most recent messages, up to about
 * 6,000 tokens (4 characters per token). Older messages are not sent; what
 * matters from them is already in the memory.
 */
export const HISTORY_CHAR_BUDGET = 24_000;
/** Rows read from the database to fill that budget. */
export const HISTORY_MAX_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 4_000;
/** About 2,000 tokens. The memory is rewritten more briefly when it grows past this. */
export const MEMORY_MAX_CHARS = 8_000;
