/**
 * Passes what the assistant heard to a project's chat. The assistant puts the
 * message here and opens the project; the chat takes it and sends it. Kept in
 * memory (client navigation keeps it), never in the URL or storage.
 */
const pending = new Map<string, string>();

export const HANDOFF_EVENT = "assistant:handoff";

export function handOff(projectId: string, message: string) {
  pending.set(projectId, message);
  // The chat may already be open (the user is on that project): tell it now.
  window.dispatchEvent(new Event(HANDOFF_EVENT));
}

export function takeHandOff(projectId: string): string | null {
  const message = pending.get(projectId) ?? null;
  pending.delete(projectId);
  return message;
}
