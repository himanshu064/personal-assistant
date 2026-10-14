"use client";

import { useEffect } from "react";

/** Registers the notification service worker on every app page, not just Settings. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Fails on insecure origins and in some private modes. The app still
      // works; it just cannot notify.
    });
  }, []);
  return null;
}
