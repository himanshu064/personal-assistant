import "server-only";
import { revalidateTag } from "next/cache";
import { inboxTag } from "@/lib/data/inbox-tags";

/**
 * Shows the new Inbox state on the next view. Never allowed to fail the work
 * around it (a finished sync, or the Google callback that links Gmail).
 */
export function refreshInbox(userId: string) {
  try {
    revalidateTag(inboxTag(userId), { expire: 0 });
  } catch (error) {
    console.warn("gmail.revalidate_failed", { message: error instanceof Error ? error.message : String(error) });
  }
}
