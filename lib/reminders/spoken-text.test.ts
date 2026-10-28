import { describe, expect, it } from "vitest";
import { normaliseSpokenTimes } from "./spoken-text";

describe("normaliseSpokenTimes", () => {
  it.each([
    // Digits with am/pm, the way speech to text writes them.
    ["call mom at 5 30 PM", "call mom at 5:30 PM"],
    ["meeting 4 30 p.m.", "meeting 4:30 p.m."],
    ["dinner 8 45 p m", "dinner 8:45 pm"],
    ["standup 10 30 am", "standup 10:30 am"],
    ["pills 9 05 am", "pills 9:05 am"],
    // Number words.
    ["call Ravi five thirty pm", "call Ravi 5:30 pm"],
    ["gym at seven fifteen", "gym at 7:15"],
    ["leave at six o'clock", "leave at 6:00"],
    ["call at nine forty-five pm", "call at 9:45 pm"],
    // No am/pm, after a word that comes before a time.
    ["call at 5 30", "call at 5:30"],
    ["send it by 17 45", "send it by 17:45"],
    ["free after 2 15", "free after 2:15"],
    // A lone "p m" after a number.
    ["call at 5 p m", "call at 5 pm"],
    ["call at 5:30 p. m.", "call at 5:30 pm"],
  ])("%s -> %s", (input, expected) => {
    expect(normaliseSpokenTimes(input)).toBe(expected);
  });

  it.each([
    // Amounts, not times.
    "pay one twenty rupees",
    "talk to one twenty people",
    "rest after 10 15 minutes",
    "5 30 amp fuses",
    // A date and an hour, not 20:10.
    "October 20 10 am",
    "on the 5 10 am",
    // Letters that only look like am/pm.
    "buy a m and m",
    // Already normal.
    "call at 5:30 pm",
  ])("leaves %s as it is", (input) => {
    expect(normaliseSpokenTimes(input)).toBe(input);
  });

  it("keeps a 24 hour time with pm (known, harmless)", () => {
    expect(normaliseSpokenTimes("at 13 30 pm")).toBe("at 13:30 pm");
  });
});
