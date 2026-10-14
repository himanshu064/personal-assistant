"use client";

import { useEffect } from "react";
import { saveDetectedTimezone } from "@/app/(app)/settings/actions";

const STORAGE_KEY = "tz-synced";

/**
 * Saves this device's timezone the first time the user opens the app, so
 * "remind me at 5pm" means 5pm where they are. The server only writes it when
 * no timezone is saved yet, so it never overrides a choice made in Settings.
 */
export function TimezoneSync() {
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      if (localStorage.getItem(STORAGE_KEY) === timezone) return;
    } catch {
      // Storage can be blocked (private mode); the server check still prevents overwrites.
    }
    saveDetectedTimezone(timezone)
      .then(() => {
        try {
          localStorage.setItem(STORAGE_KEY, timezone);
        } catch {}
      })
      .catch(() => {});
  }, []);

  return null;
}
