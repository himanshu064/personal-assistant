import { describe, expect, it } from "vitest";
import { fromLocalInputValue, toLocalInputValue, tzOffsetMinutes } from "./time";

const NY = "America/New_York";

describe("tzOffsetMinutes", () => {
  it("knows half hour zones and daylight saving", () => {
    expect(tzOffsetMinutes("Asia/Kolkata")).toBe(330);
    expect(tzOffsetMinutes("UTC")).toBe(0);
    expect(tzOffsetMinutes(NY, new Date("2026-07-01T12:00Z"))).toBe(-240);
    expect(tzOffsetMinutes(NY, new Date("2026-12-01T12:00Z"))).toBe(-300);
  });
});

describe("fromLocalInputValue", () => {
  it("reads a local time in the given timezone", () => {
    expect(fromLocalInputValue("2026-10-28T17:00", "Asia/Kolkata")!.toISOString()).toBe("2026-10-28T11:30:00.000Z");
  });

  // On a clock change day the first guess uses the wrong offset for these
  // hours; the second pass corrects it.
  it("is right in the early hours of a clock change day", () => {
    // Clocks go back at 2:00 on 1 Nov 2026: 5:00 is EST (UTC-5).
    expect(fromLocalInputValue("2026-11-01T05:00", NY)!.toISOString()).toBe("2026-11-01T10:00:00.000Z");
    // Clocks go forward at 2:00 on 14 Mar 2027: 5:00 is EDT (UTC-4).
    expect(fromLocalInputValue("2027-03-14T05:00", NY)!.toISOString()).toBe("2027-03-14T09:00:00.000Z");
  });

  it("returns null for a value that is not a datetime-local", () => {
    expect(fromLocalInputValue("", NY)).toBeNull();
    expect(fromLocalInputValue("tomorrow 5pm", NY)).toBeNull();
  });

  it("round trips with toLocalInputValue", () => {
    for (const local of ["2026-02-28T23:59", "2026-11-01T05:00", "2027-03-14T05:00"]) {
      expect(toLocalInputValue(fromLocalInputValue(local, NY)!, NY)).toBe(local);
    }
  });
});
