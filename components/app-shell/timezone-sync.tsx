"use client";

import { useEffect } from "react";
import { saveDetectedTimezone } from "@/app/(app)/settings/actions";

/**
 * Saves this device's timezone the first time a user opens the app, so
 * "remind me at 5pm" means 5pm where they are. Remembered per user on this
 * device (a shared browser with two accounts still syncs both). The server
 * never overwrites a timezone chosen in Settings.
 */
export function TimezoneSync({ userId }: { userId: string }) {
  useEffect(() => {
    const key = `tz-synced:${userId}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch {
      // Storage can be blocked (private mode); the server check still prevents overwrites.
    }
    saveDetectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then(() => {
        try {
          localStorage.setItem(key, "1");
        } catch {}
      })
      .catch(() => {});
  }, [userId]);

  return null;
}
