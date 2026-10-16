/** The reminders cron runs every 15 minutes (:00, :15, :30, :45); alerts land on those checks. */
export const ALERT_GAP_MS = 15 * 60_000;

/**
 * When a reminder's alerts go out ("Rule B", agreed 16 Oct 2026):
 * - The LAST alert is the 15 minute check closest to (time minus "Alert me").
 *   "Call at 4:40", 15 minutes before: 4:25 is closest to the 4:30 check.
 *   With "Alert me" of 15 or more this is always before the reminder's time.
 * - With more alerts, each earlier one is 15 minutes before the next:
 *   3 alerts gives 4:00, 4:15, 4:30.
 * - Alerts whose check has already passed are skipped (counted as sent);
 *   the last one is always kept.
 * - "Alert me" 0 (only after a snooze) rounds down instead, so it is never late.
 *
 * Returns the next alert time and how many alerts count as already sent.
 */
export function alertSchedule(remindAt: Date, leadMinutes: number, alertCount: number, now: Date = new Date()) {
  const target = remindAt.getTime() - leadMinutes * 60_000;
  const last = (leadMinutes > 0 ? Math.round(target / ALERT_GAP_MS) : Math.floor(target / ALERT_GAP_MS)) * ALERT_GAP_MS;
  const count = Math.min(Math.max(Math.trunc(alertCount), 1), 5);
  const first = last - (count - 1) * ALERT_GAP_MS;
  let skipped = 0;
  while (skipped < count - 1 && first + skipped * ALERT_GAP_MS <= now.getTime()) skipped++;
  return { notifyAt: new Date(first + skipped * ALERT_GAP_MS), alertsSent: skipped };
}
