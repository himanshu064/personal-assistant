import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailItems, gmailSync } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { inboxTag } from "./inbox-tags";

export { inboxTag };

export type InboxStatus = "new" | "added" | "dismissed";
export const INBOX_STATUSES: InboxStatus[] = ["new", "added", "dismissed"];

export type GmailConnection = {
  email: string | null;
  status: "active" | "needs_reconnect";
  problem: string | null;
  lastSyncedAt: Date | null;
  /** A sync started in the last 10 minutes and has not finished. */
  syncing: boolean;
};

export type InboxItem = {
  id: string;
  gmailMessageId: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
  status: InboxStatus;
  kind: "meeting" | "reminder" | "deadline";
  foundBy: "invite" | "ai";
  title: string;
  startsAt: Date | null;
  location: string | null;
  link: string | null;
  reminderId: string | null;
};

export type InboxCounts = Record<InboxStatus, number> & Record<InboxItem["kind"], number>;

/** The user's Gmail connection, or null when Gmail is not connected. */
export async function getMyGmail(): Promise<GmailConnection | null> {
  const user = await requireUser();
  return readConnection(user.id);
}

async function readConnection(userId: string): Promise<GmailConnection | null> {
  "use cache";
  cacheTag(inboxTag(userId));
  cacheLife("minutes");

  const [row] = await db
    .select({
      email: gmailSync.email,
      status: gmailSync.status,
      problem: gmailSync.problem,
      lastSyncedAt: gmailSync.lastSyncedAt,
      syncing: sql<boolean>`coalesce(${gmailSync.syncStartedAt} > now() - interval '10 minutes', false)`,
    })
    .from(gmailSync)
    .where(eq(gmailSync.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Suggestions with one status (newest email first, up to 200), plus the
 * counts for every filter, in two parallel queries over the user's index.
 */
export async function getMyInbox(status: InboxStatus): Promise<{ items: InboxItem[]; counts: InboxCounts }> {
  const user = await requireUser();
  return readInbox(user.id, status);
}

async function readInbox(userId: string, status: InboxStatus) {
  "use cache";
  cacheTag(inboxTag(userId));
  cacheLife("minutes");

  const [items, [counts]] = await Promise.all([
    db
      .select({
        id: emailItems.id,
        gmailMessageId: emailItems.gmailMessageId,
        fromName: emailItems.fromName,
        fromAddress: emailItems.fromAddress,
        subject: emailItems.subject,
        snippet: emailItems.snippet,
        receivedAt: emailItems.receivedAt,
        status: emailItems.status,
        kind: emailItems.kind,
        foundBy: emailItems.foundBy,
        title: emailItems.title,
        startsAt: emailItems.startsAt,
        location: emailItems.location,
        link: emailItems.link,
        reminderId: emailItems.reminderId,
      })
      .from(emailItems)
      .where(and(eq(emailItems.userId, userId), eq(emailItems.status, status)))
      .orderBy(desc(emailItems.receivedAt))
      .limit(200),
    db
      .select({
        new: sql<number>`count(*) filter (where ${emailItems.status} = 'new')`.mapWith(Number),
        added: sql<number>`count(*) filter (where ${emailItems.status} = 'added')`.mapWith(Number),
        dismissed: sql<number>`count(*) filter (where ${emailItems.status} = 'dismissed')`.mapWith(Number),
        // Type counts are for the status being viewed.
        meeting: sql<number>`count(*) filter (where ${emailItems.status} = ${status} and ${emailItems.kind} = 'meeting')`.mapWith(Number),
        reminder: sql<number>`count(*) filter (where ${emailItems.status} = ${status} and ${emailItems.kind} = 'reminder')`.mapWith(Number),
        deadline: sql<number>`count(*) filter (where ${emailItems.status} = ${status} and ${emailItems.kind} = 'deadline')`.mapWith(Number),
      })
      .from(emailItems)
      .where(and(eq(emailItems.userId, userId), inArray(emailItems.status, INBOX_STATUSES))),
  ]);

  return {
    // Shown rows always have a kind, a finder and a title (only "ignored" rows lack them).
    items: items.map((i) => ({ ...i, kind: i.kind!, foundBy: i.foundBy!, title: i.title ?? i.subject, status: i.status as InboxStatus })),
    counts: counts ?? { new: 0, added: 0, dismissed: 0, meeting: 0, reminder: 0, deadline: 0 },
  };
}
