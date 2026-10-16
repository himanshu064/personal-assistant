/**
 * Speech to text writes times the way they are said: "5 30 PM", "4 30 p.m.",
 * "five thirty pm". The date reader (chrono) then reads "5 30 PM" as 5:00 AM.
 * This turns spoken times into normal ones ("5:30 PM") before anything reads
 * the text (the rules reader and the AI). Measured 16 Oct 2026, see the commit.
 */

const HOUR_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const MINUTE_WORDS: Record<string, string> = {
  "o'clock": "00", oclock: "00", "oh five": "05", ten: "10", fifteen: "15", twenty: "20", "twenty five": "25", "twenty-five": "25",
  thirty: "30", "thirty five": "35", "thirty-five": "35", forty: "40", "forty five": "45", "forty-five": "45", fifty: "50", "fifty five": "55", "fifty-five": "55",
};

/** "am", "p.m.", "p m"; not the start of a longer word ("5 30 amp fuses"). */
const AMPM = String.raw`(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])`;
/** A day number comes right after these ("October 20 10 am", "the 5 10 am"): it is a date, not an hour. */
const BEFORE_DAY = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?|the)\s+$/i;
/** Words before a time when no am/pm is said ("at 5 30", "by 9 15"). */
const LEAD = String.raw`(at|by|before|after|around|from|till|until|to)`;

export function normaliseSpokenTimes(text: string): string {
  let t = text;

  // "five thirty pm", "at seven fifteen": number words to digits.
  const hour = Object.keys(HOUR_WORDS).join("|");
  const minute = Object.keys(MINUTE_WORDS).sort((a, b) => b.length - a.length).join("|");
  // Only next to a time hint ("at five thirty", "five thirty pm"), so "pay one twenty rupees" stays as it is.
  const toDigits = (h: string, m: string) => `${HOUR_WORDS[h.toLowerCase()]}:${MINUTE_WORDS[m.toLowerCase()]}`;
  t = t.replace(new RegExp(String.raw`\b(${hour})\s+(${minute})(?=\s*${AMPM})`, "gi"), (_, h: string, m: string) => toDigits(h, m));
  t = t.replace(new RegExp(String.raw`\b${LEAD}\s+(${hour})\s+(${minute})\b`, "gi"), (_, lead: string, h: string, m: string) => `${lead} ${toDigits(h, m)}`);

  // "5 30 PM", "4 30 p.m.", "8 45 p m" -> "5:30 PM".
  // Hours 1 to 12 only. After a month, "20 10 am" is a day and an hour (left as it is), while
  // "10 30 am" can only be 10:30 (30 is not an hour).
  t = t.replace(new RegExp(String.raw`\b(\d{1,2})\s+([0-5]\d)\s*${AMPM}`, "gi"), (whole: string, h: string, m: string, ap: string, at: number, all: string) => {
    const isHour = Number(h) >= 1 && Number(h) <= 12;
    const dayAndHour = BEFORE_DAY.test(all.slice(0, at)) && Number(m) >= 1 && Number(m) <= 12;
    return isHour && !dayAndHour ? `${h}:${m} ${ap}` : whole;
  });
  // "at 5 30", "by 17 45" (no am/pm) -> "at 5:30".
  t = t.replace(new RegExp(String.raw`\b${LEAD}\s+([01]?\d|2[0-3])\s+([0-5]\d)\b`, "gi"), (_, lead, h, m) => `${lead} ${h}:${m}`);
  // "p m" / "p. m." -> "pm".
  t = t.replace(/\b([ap])\.?\s+m\.?(?=\s|$|[,.!?])/gi, (_, x: string) => `${x}m`);

  return t;
}
