import { describe, expect, it } from "vitest";
import { alertSchedule } from "./schedule";

const t = (hhmm: string) => new Date(`2026-10-28T${hhmm}:00Z`);
const EARLY = t("12:00");

/** The alert times as "HH:MM", from the first unsent one. */
function alerts(remindAt: string, lead: number, count: number, now = EARLY) {
  const { notifyAt, alertsSent } = alertSchedule(t(remindAt), lead, count, now);
  return { notifyAt: notifyAt.toISOString().slice(11, 16), alertsSent };
}

describe("alertSchedule (Rule B)", () => {
  it("lands the last alert on the closest 15 minute check", () => {
    // Call at 4:40, 15 minutes before: 4:25 is closest to the 4:30 check.
    expect(alerts("16:40", 15, 1)).toEqual({ notifyAt: "16:30", alertsSent: 0 });
    expect(alerts("17:00", 15, 1)).toEqual({ notifyAt: "16:45", alertsSent: 0 });
    expect(alerts("17:00", 60, 1)).toEqual({ notifyAt: "16:00", alertsSent: 0 });
  });

  it("puts earlier alerts 15 minutes apart", () => {
    expect(alerts("16:40", 15, 3)).toEqual({ notifyAt: "16:00", alertsSent: 0 });
  });

  it("skips alerts whose check has passed and counts them as sent", () => {
    expect(alerts("16:40", 15, 3, t("16:05"))).toEqual({ notifyAt: "16:15", alertsSent: 1 });
    expect(alerts("16:40", 15, 3, t("16:20"))).toEqual({ notifyAt: "16:30", alertsSent: 2 });
  });

  it("always keeps the last alert, even when it has passed", () => {
    expect(alerts("16:40", 15, 3, t("16:35"))).toEqual({ notifyAt: "16:30", alertsSent: 2 });
  });

  it("rounds down with no lead time (after a snooze), so it is never late", () => {
    expect(alerts("16:40", 0, 1)).toEqual({ notifyAt: "16:30", alertsSent: 0 });
    expect(alerts("16:44", 0, 1)).toEqual({ notifyAt: "16:30", alertsSent: 0 });
  });

  it("keeps the alert count between 1 and 5", () => {
    expect(alerts("16:40", 15, 0)).toEqual({ notifyAt: "16:30", alertsSent: 0 });
    expect(alerts("16:40", 15, 9)).toEqual({ notifyAt: "15:30", alertsSent: 0 });
  });
});
