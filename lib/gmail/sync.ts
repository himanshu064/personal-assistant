import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailItems, gmailSync } from "@/db/schema";
import { getDraftContext } from "@/lib/ai/user-model";
import { getAttachment, getMessage, getProfile, GmailAuthError, inBatches, listMessageIds, type GmailMessage } from "./client";
import { getGmailAccessToken } from "./connection";
import { refreshInbox } from "./refresh";
import { AI_BATCH, detectWithAi, type AiFinding, type EmailForAi } from "./detect-ai";
import { parseInvite } from "./ics";
import { bodyText, decodeBase64Url, findCalendarPart, findMeetingLink, header, parseFrom } from "./parse";

/**
 * Gmail search for emails likely to hold a meeting, appointment or deadline.
 * Gmail does this filtering on its side, so promotions and chatter are never
 * downloaded at all.
 */
const SEARCH =
  "-category:promotions -category:social -in:sent -in:chats -in:drafts " +
  '(filename:ics OR invite OR invitation OR meeting OR appointment OR booking OR scheduled OR reminder OR deadline OR due OR "zoom.us" OR "meet.google.com" OR "teams.microsoft.com")';

/** First sync: the newest emails of the last 30 days (the ones most likely still to come). */
const FIRST_SYNC_MAX = 100;
/** Later syncs: emails listed per run, and emails read per run (oldest first; the rest continue next run). */
const LATER_LIST_MAX = 500;
const LATER_PER_RUN = 60;
/** Later syncs reach back this far before the last sync, so mail arriving mid sync is not missed. */
const OVERLAP_MS = 15 * 60_000;
/** A sync older than this is treated as crashed, so the lock does not stick forever. */
const STALE_LOCK = "10 minutes";
const AI_FAILED =
  "Some emails could not be checked because your AI key did not work. Check it in Settings; they are checked again on the next sync.";

export type SyncResult =
  | { ok: true; checked: number; suggested: number }
  | { ok: false; reason: "busy" | "not_connected" | "reconnect" | "error" };

type Row = typeof emailItems.$inferInsert;

/**
 * Reads new Gmail, finds meetings and deadlines, and saves them as
 * suggestions. Safe to call from the cron and from "Sync now" at the same
 * time: a lock in gmail_sync lets only one run per user.
 */
export async function syncGmail(userId: string): Promise<SyncResult> {
  const startedAt = new Date();
  const [claimed] = await db
    .update(gmailSync)
    .set({ syncStartedAt: startedAt })
    .where(
      and(
        eq(gmailSync.userId, userId),
        eq(gmailSync.status, "active"),
        sql`(${gmailSync.syncStartedAt} is null or ${gmailSync.syncStartedAt} < now() - ${STALE_LOCK}::interval)`,
      ),
    )
    .returning({ accountId: gmailSync.accountId, email: gmailSync.email, lastSyncedAt: gmailSync.lastSyncedAt });
  if (!claimed) {
    const [row] = await db.select({ status: gmailSync.status }).from(gmailSync).where(eq(gmailSync.userId, userId)).limit(1);
    return { ok: false, reason: !row ? "not_connected" : row.status === "active" ? "busy" : "reconnect" };
  }

  try {
    const [token, context] = await Promise.all([getGmailAccessToken(userId, claimed.accountId), getDraftContext(userId)]);
    const timezone = context.timezone ?? "UTC";
    const email = claimed.email ?? (await getProfile(token)).emailAddress;

    // 1. Which emails to look at: never seen before. Gmail lists newest first.
    const firstSync = !claimed.lastSyncedAt;
    const query = firstSync
      ? `${SEARCH} newer_than:30d`
      : `${SEARCH} after:${Math.floor((claimed.lastSyncedAt!.getTime() - OVERLAP_MS) / 1000)}`;
    const ids = await listMessageIds(token, query, firstSync ? FIRST_SYNC_MAX : LATER_LIST_MAX);
    const seen = ids.length
      ? new Set(
          (
            await db
              .select({ id: emailItems.gmailMessageId })
              .from(emailItems)
              .where(and(eq(emailItems.userId, userId), inArray(emailItems.gmailMessageId, ids)))
          ).map((r) => r.id),
        )
      : new Set<string>();
    const fresh = ids.filter((id) => !seen.has(id));
    // Later syncs read the OLDEST unread first, so a busy day continues next run instead of being skipped.
    const batch = firstSync ? fresh : fresh.slice(-LATER_PER_RUN);
    const more = !firstSync && fresh.length > batch.length;

    // 2. Download them, a few at a time (an email deleted meanwhile comes back as null), oldest first,
    //    so when one meeting has several invite emails (an update, then a cancellation) the latest wins.
    const messages = (await inBatches(batch, 5, (id) => getMessage(token, id)))
      .filter((m): m is GmailMessage => m !== null)
      .sort((x, y) => Number(x.internalDate ?? 0) - Number(y.internalDate ?? 0));

    // 3. Calendar invites are read directly (free). The rest go to the AI, if the user has a key.
    const rows: Row[] = [];
    const forAi: { message: GmailMessage; email: EmailForAi }[] = [];
    for (const message of messages) {
      const base = baseRow(userId, message);
      const calendar = findCalendarPart(message);
      const ics = calendar
        ? decodeBase64Url(calendar.data ?? (await getAttachment(token, message.id, calendar.attachmentId!)))
        : "";
      const invite = ics ? parseInvite(ics, timezone) : null;
      if (invite) {
        rows.push({
          ...base,
          // Only a real invite with a title is suggested; replies ("Accepted: ...") and cancellations are not.
          status: invite.action !== "invite" || !invite.title ? "ignored" : statusFor(invite.startsAt),
          kind: "meeting",
          foundBy: "invite",
          title: invite.title.slice(0, 200) || base.subject,
          startsAt: invite.startsAt,
          location: invite.location?.slice(0, 300) ?? null,
          link: findMeetingLink(`${invite.location ?? ""} ${invite.description}`) ?? findMeetingLink(bodyText(message, 20_000)),
          eventUid: invite.uid,
        });
      } else if (context.cheapModel) {
        forAi.push({ message, email: { id: message.id, from: header(message, "From"), subject: base.subject, receivedAt: base.receivedAt, text: bodyText(message) } });
      } else {
        // Without an AI key only invites are found. Saved as checked, so it is not downloaded again.
        rows.push({ ...base, status: "ignored" });
      }
    }

    // 4. The AI, 10 emails per request, two requests at a time. A failed request leaves its
    //    emails unsaved (and the sync position unmoved), so they are tried again next run.
    let aiFailed = false;
    if (context.cheapModel && forAi.length) {
      const model = context.cheapModel;
      const groups: (typeof forAi)[] = [];
      for (let i = 0; i < forAi.length; i += AI_BATCH) groups.push(forAi.slice(i, i + AI_BATCH));
      const results = await inBatches(groups, 2, async (group) => {
        try {
          return { group, findings: await detectWithAi(model, group.map((g) => g.email), timezone) };
        } catch (error) {
          console.warn("gmail.ai_failed", { userId, message: error instanceof Error ? error.message : String(error) });
          aiFailed = true;
          return { group, findings: null };
        }
      });
      for (const { group, findings } of results) {
        if (!findings) continue;
        const byId = new Map<string, AiFinding>(findings.map((f) => [f.id, f]));
        for (const { message } of group) {
          const base = baseRow(userId, message);
          const found = byId.get(message.id);
          rows.push(
            found
              ? { ...base, status: statusFor(found.startsAt), kind: found.kind, foundBy: "ai", title: found.title, startsAt: found.startsAt, location: found.location, link: found.link }
              : { ...base, status: "ignored" },
          );
        }
      }
    }

    // 5. Save everything in one statement; the unique index skips anything saved meanwhile.
    if (rows.length) await db.insert(emailItems).values(rows).onConflictDoNothing();

    // An updated or cancelled invite replaces the earlier suggestion for the same meeting.
    const uids = [...new Set(rows.map((r) => r.eventUid).filter((u): u is string => Boolean(u)))];
    if (uids.length) {
      await db.execute(sql`
        update email_items e set status = 'ignored', updated_at = now()
         where e.user_id = ${userId} and e.status = 'new' and e.event_uid in ${uids}
           and exists (select 1 from email_items n
                        where n.user_id = e.user_id and n.event_uid = e.event_uid and n.received_at > e.received_at)
      `);
    }

    // 6. Move the sync position: to now, or (more to read) to the newest email read, or (AI failed) nowhere.
    const newest = messages.at(-1);
    const nextPosition = aiFailed
      ? claimed.lastSyncedAt
      : more && newest
        ? new Date(Number(newest.internalDate ?? startedAt.getTime()))
        : startedAt;
    await db
      .update(gmailSync)
      .set({ email, lastSyncedAt: nextPosition, syncStartedAt: null, problem: aiFailed ? AI_FAILED : null })
      .where(eq(gmailSync.userId, userId));
    refreshInbox(userId);
    return { ok: true, checked: messages.length, suggested: rows.filter((r) => r.status === "new").length };
  } catch (error) {
    if (error instanceof GmailAuthError) {
      await db
        .update(gmailSync)
        .set({
          status: "needs_reconnect",
          problem: "Gmail access ended. This happens every 7 days while the app is in Google's testing mode, or if access was removed. Reconnect to continue.",
          syncStartedAt: null,
        })
        .where(eq(gmailSync.userId, userId));
      refreshInbox(userId);
      return { ok: false, reason: "reconnect" };
    }
    // Anything else (Gmail or the AI briefly failing): release the lock and try again next run.
    // lastSyncedAt is not moved, so no email is skipped.
    console.error("gmail.sync_failed", { userId, message: error instanceof Error ? error.message : String(error) });
    await db.update(gmailSync).set({ syncStartedAt: null }).where(eq(gmailSync.userId, userId));
    return { ok: false, reason: "error" };
  }
}

/** Past meetings and deadlines are kept (so they are never read again) but not suggested. */
function statusFor(startsAt: Date | null): "new" | "ignored" {
  return startsAt && startsAt.getTime() < Date.now() ? "ignored" : "new";
}

function baseRow(userId: string, message: GmailMessage) {
  const from = parseFrom(header(message, "From"));
  return {
    userId,
    gmailMessageId: message.id,
    threadId: message.threadId,
    fromName: from.name.slice(0, 200),
    fromAddress: from.address.slice(0, 320),
    subject: (header(message, "Subject") || "(no subject)").slice(0, 300),
    snippet: decodeEntities(message.snippet ?? "").slice(0, 500),
    receivedAt: new Date(Number(message.internalDate ?? Date.now())),
  };
}

/** Gmail snippets come HTML escaped ("&#39;"). */
function decodeEntities(text: string) {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
