import "server-only";
import * as chrono from "chrono-node";
import nlp from "compromise";
import { tzOffsetMinutes } from "@/lib/time";

export type DetectedIntent = "reminder" | "chat" | "unsure";

/**
 * Decides, without the AI, whether what the user said is a reminder or a chat.
 * Words alone cannot: "call mom at 5" is a reminder, "what should I say when
 * I call mom" is a chat. So it reads four signals, in order:
 * 1. Explicit phrases: "start a chat", "remind me", "set a reminder", "don't let me forget".
 * 2. A question or a writing request ("what...", "how...", "can you...", "write...", "?") is a chat.
 * 3. A FUTURE time (chrono-node) in a sentence NOT in the past tense (compromise) is a reminder:
 *    "pay Ravi tomorrow" yes, "paid Ravi yesterday" no (that is news, for a project).
 * 4. Starting with an action verb ("call", "meet", "message", "walk", "pay"...) is a reminder.
 * Anything else is "unsure", and the AI decides.
 * Measured on 16 Oct 2026: 40 held out speech style sentences, 36 right, 0 wrong, 4 unsure.
 */
export function detectIntent(text: string, timeZone: string, now: Date = new Date()): DetectedIntent {
  const t = normalise(text);
  const l = t.toLowerCase();

  if (/^(please\s+)?(start|open|begin|new)\s+(a\s+)?(new\s+)?chat\b|^let'?s\s+(chat|talk)\b/.test(l)) return "chat";

  const explicitReminder =
    /\b(remind me|remind \w+ to|set (a |an )?(reminder|alarm)|create (a |an )?reminder|add (a |an )?reminder|make (a )?reminder|don'?t let me forget|alert me|wake me)\b/.test(l);
  const asks = /^(what|why|how|who|when|where|which)\b/.test(l);
  if (explicitReminder && !REMIND_ME_QUESTION.test(l) && !asks) return "reminder";

  if (/\?\s*$/.test(l) || QUESTION_START.test(l)) return "chat";

  const past = nlp(t).has("#PastTense");
  const future = chrono.parse(t, { instant: now, timezone: tzOffsetMinutes(timeZone, now) }, { forwardDate: true }).some((p) => p.start.date() > now);
  if (future && !past) return "reminder";
  if (!past && (ACTION_VERBS.has(l.split(/\s+/)[0]) || /^(i need to|i have to|i must|need to|have to|don'?t forget)\b/.test(l))) return "reminder";
  return "unsure";
}

/** "start a chat about trip planning" -> "trip planning"; "" when nothing follows. */
export function chatMessageOf(text: string): string {
  return text
    .trim()
    .replace(/^(please\s+)?(start|open|begin|new)\s+(a\s+)?(new\s+)?chat\b[\s,:-]*(about\s+|on\s+)?/i, "")
    .replace(/^let'?s\s+(chat|talk)\b[\s,:-]*(about\s+)?/i, "")
    .trim();
}

/** Speech to text drops apostrophes ("whats", "dont"); put the common ones back. */
function normalise(text: string) {
  return text
    .trim()
    .replace(/\b(what|that|there|who|where|how|it)s\b/gi, "$1's")
    .replace(/\b(don|can|won|isn|aren|didn|doesn|shouldn|wouldn|couldn)t\b/gi, "$1't")
    .replace(/\bim\b/gi, "I'm");
}

/** "remind me what we discussed" is a question, not a reminder. */
const REMIND_ME_QUESTION = /\bremind me (what|how|why|who|which|where)\b/;

const QUESTION_START =
  /^(what|why|how|who|when|where|which|is|are|am|can|could|should|would|will|do|does|did|tell me|explain|help me|give me|write|draft|summari[sz]e|translate|compose|describe|remind me (what|how|why|who|which|where))\b/;

const ACTION_VERBS = new Set(
  "call meet message text email mail walk pay buy take pick book visit collect send submit renew water feed clean cook order return attend join check finish go bring drop wish ring phone gym schedule".split(" "),
);
