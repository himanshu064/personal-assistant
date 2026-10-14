import type { GmailMessage, GmailPart } from "./client";

/** Gmail sends bodies as base64url. */
export function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function header(message: GmailMessage, name: string): string {
  const wanted = name.toLowerCase();
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === wanted)?.value ?? "";
}

/** `"Priya Shah" <priya@acme.com>` becomes { name: "Priya Shah", address: "priya@acme.com" }. */
export function parseFrom(value: string): { name: string; address: string } {
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const address = match[2].trim();
    return { name: match[1].trim() || address, address };
  }
  const address = value.trim();
  return { name: address, address };
}

function walk(part: GmailPart | undefined, visit: (p: GmailPart) => void) {
  if (!part) return;
  visit(part);
  for (const child of part.parts ?? []) walk(child, visit);
}

/**
 * The email's text, for the AI: the plain text part, or the HTML part with
 * tags removed. Capped, so a long newsletter never costs many tokens.
 */
export function bodyText(message: GmailMessage, maxChars = 2_000): string {
  let plain = "";
  let html = "";
  walk(message.payload, (p) => {
    if (!p.body?.data || p.filename) return;
    if (p.mimeType === "text/plain" && !plain) plain = decodeBase64Url(p.body.data);
    if (p.mimeType === "text/html" && !html) html = decodeBase64Url(p.body.data);
  });
  const text =
    plain ||
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"');
  return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim().slice(0, maxChars);
}

/**
 * Where a calendar invite is: inline text (text/calendar) or an .ics file
 * that must be downloaded separately (attachmentId). Null when there is none.
 */
export function findCalendarPart(message: GmailMessage): { data?: string; attachmentId?: string } | null {
  let found: { data?: string; attachmentId?: string } | null = null;
  walk(message.payload, (p) => {
    if (found) return;
    const isCalendar = p.mimeType === "text/calendar" || p.mimeType === "application/ics" || /\.ics$/i.test(p.filename ?? "");
    if (isCalendar && (p.body?.data || p.body?.attachmentId)) found = { data: p.body.data, attachmentId: p.body.attachmentId };
  });
  return found;
}

/** The first Meet, Zoom or Teams link in some text. */
export function findMeetingLink(text: string): string | null {
  const match = text.match(/https:\/\/(?:meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com|teams\.live\.com)\/[^\s"'<>)\]]+/i);
  return match ? match[0] : null;
}
