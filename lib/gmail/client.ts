import "server-only";

/**
 * The few Gmail API calls the sync needs, with plain fetch (no SDK). Errors
 * that mean "reconnect Gmail" are thrown as GmailAuthError, so the caller can
 * show the reconnect banner instead of retrying forever.
 */

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class GmailAuthError extends Error {}
/** The email no longer exists (deleted between listing and reading it). */
class GmailNotFoundError extends Error {}

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};
export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

async function gmailFetch<T>(token: string, path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));

  // One retry on "slow down" (429) or a passing server error, after a short wait.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.ok) return (await res.json()) as T;
    // Gmail also answers 403 for rate limits ("userRateLimitExceeded"); only other 403s mean lost access.
    const reason = res.status === 403 ? await res.text().catch(() => "") : "";
    const rateLimited = res.status === 429 || /rateLimitExceeded/i.test(reason);
    if (res.status === 401 || (res.status === 403 && !rateLimited)) {
      throw new GmailAuthError(`Gmail refused access (${res.status})`);
    }
    if (res.status === 404) throw new GmailNotFoundError(`Gmail ${path} not found`);
    if ((rateLimited || res.status >= 500) && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    throw new Error(`Gmail ${path} failed with ${res.status}`);
  }
}

export function getProfile(token: string) {
  return gmailFetch<{ emailAddress: string }>(token, "/profile");
}

/** Ids of messages matching a Gmail search, newest first, up to `max`. */
export async function listMessageIds(token: string, q: string, max: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await gmailFetch<{ messages?: { id: string }[]; nextPageToken?: string }>(token, "/messages", {
      q,
      maxResults: Math.min(100, max - ids.length),
      pageToken,
    });
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

/** The full email, or null when it was deleted after it was listed. */
export async function getMessage(token: string, id: string): Promise<GmailMessage | null> {
  try {
    return await gmailFetch<GmailMessage>(token, `/messages/${id}`, { format: "full" });
  } catch (error) {
    if (error instanceof GmailNotFoundError) return null;
    throw error;
  }
}

/** An attachment's data (base64url), or "" when it is gone. */
export async function getAttachment(token: string, messageId: string, attachmentId: string): Promise<string> {
  try {
    const res = await gmailFetch<{ data?: string }>(token, `/messages/${messageId}/attachments/${attachmentId}`);
    return res.data ?? "";
  } catch (error) {
    if (error instanceof GmailNotFoundError) return "";
    throw error;
  }
}

/**
 * Runs `fn` over `items` a few at a time. Gmail has no bulk read, and firing
 * every request at once is how you hit its per user rate limit (pattern from
 * email-automation's lib/gmail.ts).
 */
export async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}
