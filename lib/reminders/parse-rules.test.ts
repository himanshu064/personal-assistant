import { describe, expect, it } from "vitest";
import { parseReminderWithRules } from "./parse-rules";
import { normaliseSpokenTimes } from "./spoken-text";

const TZ = "Asia/Kolkata";
// Wednesday 28 Oct 2026, 10:00 in India.
const NOW = new Date("2026-10-28T04:30:00Z");

const parse = (spoken: string) => parseReminderWithRules(normaliseSpokenTimes(spoken), TZ, NOW);

describe("parseReminderWithRules", () => {
  it("reads a spoken time once it is normalised", () => {
    expect(parse("remind me to call Ravi tomorrow at 5 30 pm")).toMatchObject({ title: "Call Ravi", remindAt: "2026-10-29T17:30" });
  });

  it("would read 5 30 PM as 5 AM without normalising (why spoken-text exists)", () => {
    expect(parseReminderWithRules("call Ravi tomorrow at 5 30 PM", TZ, NOW).remindAt).toBe("2026-10-29T05:00");
  });

  it("uses 9:00 when only a day is said", () => {
    expect(parse("pay rent on friday")).toMatchObject({ title: "Pay rent", remindAt: "2026-10-30T09:00" });
  });

  it("uses the user's timezone, not the server's", () => {
    expect(parseReminderWithRules("call mom at 8 pm", "America/New_York", NOW).remindAt).toBe("2026-10-28T20:00");
  });

  it("keeps the whole text as the title when there is no date", () => {
    expect(parse("remind me to buy milk")).toMatchObject({ title: "Buy milk", remindAt: "", via: "rules" });
  });
});
