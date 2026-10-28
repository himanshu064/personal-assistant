import { describe, expect, it } from "vitest";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/time";
import { nextOccurrence, repeatLabel, type Repeat } from "./repeat";

const IN = "Asia/Kolkata";
const NY = "America/New_York";

const at = (local: string, tz = IN) => fromLocalInputValue(local, tz)!;

/** The next date as a local value, starting from the first date, just after `after`. */
function next(repeat: Repeat, anchor: string, after: string, tz = IN) {
  const first = at(anchor, tz);
  const result = nextOccurrence(repeat, first, first, tz, at(after, tz));
  return result && toLocalInputValue(result, tz);
}

describe("nextOccurrence", () => {
  it("returns null for none", () => {
    expect(next("none", "2026-10-28T09:00", "2026-10-28T10:00")).toBeNull();
  });

  it("daily and weekly", () => {
    expect(next("daily", "2026-10-28T09:00", "2026-10-28T10:00")).toBe("2026-10-29T09:00");
    expect(next("weekly", "2026-10-28T09:00", "2026-10-28T10:00")).toBe("2026-11-04T09:00");
  });

  it("skips missed dates instead of firing them all", () => {
    expect(next("daily", "2026-10-01T09:00", "2026-10-28T10:00")).toBe("2026-10-29T09:00");
  });

  it("weekdays: Friday to Monday", () => {
    expect(next("weekdays", "2026-10-30T09:00", "2026-10-30T10:00")).toBe("2026-11-02T09:00");
  });

  it("monthly on the 31st: end of a short month, then the 31st again", () => {
    expect(next("monthly", "2026-01-31T09:00", "2026-02-01T00:00")).toBe("2026-02-28T09:00");
    expect(next("monthly", "2026-01-31T09:00", "2026-03-01T00:00")).toBe("2026-03-31T09:00");
    expect(next("monthly", "2026-01-31T09:00", "2026-04-01T00:00")).toBe("2026-04-30T09:00");
  });

  it("yearly on 29 February: 28 February in normal years, 29th in leap years", () => {
    expect(next("yearly", "2028-02-29T09:00", "2028-03-01T00:00")).toBe("2029-02-28T09:00");
    expect(next("yearly", "2028-02-29T09:00", "2031-03-01T00:00")).toBe("2032-02-29T09:00");
  });

  it("keeps the local time across the US clock change", () => {
    // Clocks go back on 1 Nov 2026 in New York: 9:00 is 13:00 UTC before, 14:00 UTC after.
    const first = at("2026-10-31T09:00", NY);
    const result = nextOccurrence("daily", first, first, NY, at("2026-10-31T10:00", NY))!;
    expect(toLocalInputValue(result, NY)).toBe("2026-11-01T09:00");
    expect(first.toISOString()).toBe("2026-10-31T13:00:00.000Z");
    expect(result.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });

  it("counts the first date when a snooze moved the reminder before it", () => {
    const anchor = at("2026-10-30T09:00");
    const current = at("2026-10-29T18:00");
    const result = nextOccurrence("weekly", current, anchor, IN, at("2026-10-29T18:00"));
    expect(toLocalInputValue(result!, IN)).toBe("2026-10-30T09:00");
  });
});

describe("repeatLabel", () => {
  it.each<[Repeat, string]>([
    ["none", "Does not repeat"],
    ["daily", "Daily"],
    ["weekdays", "Every weekday (Monday to Friday)"],
    ["weekly", "Weekly on Friday"],
    ["monthly", "Monthly on the 16th"],
    ["yearly", "Yearly on 16 October"],
  ])("%s", (repeat, label) => {
    expect(repeatLabel(repeat, "2026-10-16T16:40")).toBe(label);
  });

  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
    [22, "22nd"],
    [31, "31st"],
  ])("monthly on day %i is the %s", (day, word) => {
    expect(repeatLabel("monthly", `2026-10-${String(day).padStart(2, "0")}T09:00`)).toBe(`Monthly on the ${word}`);
  });

  it("uses plain words without a date", () => {
    expect(repeatLabel("weekly")).toBe("Weekly");
    expect(repeatLabel("monthly", "")).toBe("Monthly");
  });
});
