/**
 * Passes what the assistant heard to a project's chat. The assistant puts the
 * message here and opens the project; the chat takes it and sends it. Kept in
 * memory (client navigation keeps it), never in the URL or storage.
 */
const pending = new Map<string, string>();

export const HANDOFF_EVENT = "assistant:handoff";
/** The key for a message going to a new quick chat (the Chat section). */
export const QUICK_CHAT_HANDOFF = "quick-chat";

/** `key` is a project id, or QUICK_CHAT_HANDOFF for a new quick chat. */
export function handOff(key: string, message: string) {
  pending.set(key, message);
  // The chat may already be open (the user is on that project): tell it now.
  window.dispatchEvent(new Event(HANDOFF_EVENT));
}

export function takeHandOff(key: string): string | null {
  const message = pending.get(key) ?? null;
  pending.delete(key);
  return message;
}
