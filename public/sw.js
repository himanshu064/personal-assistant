/**
 * Service worker: notifications only, ported from email-automation.
 * It does not cache pages for offline use on purpose; reminders are the job.
 *
 * Rule for this whole file: EVERY push shows a notification. A push that shows
 * nothing is a "silent push": Chrome replaces it with a generic message, and
 * iOS cancels the subscription after a few, silently switching reminders off.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }

  if (!payload || !payload.title) {
    event.waitUntil(
      self.registration.showNotification("Reminder", { body: "You have a new reminder.", tag: "fallback" }),
    );
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // One tag per reminder, so a snoozed reminder replaces its old banner...
      tag: payload.tag,
      // ...and still alerts again instead of replacing it silently.
      renotify: true,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      vibrate: [200, 100, 200],
      data: payload,
      // Done stops any alerts still to come; Snooze alerts once more in 15 minutes.
      // Shown where supported (Chrome, Edge, Android); Safari shows none and a tap opens the app.
      actions: payload.id
        ? [
            { action: "done", title: "Done" },
            { action: "snooze", title: "Snooze 15 min" },
          ]
        : [],
    }),
  );
});

/**
 * Push services can retire an endpoint and issue a new one. Chrome fires this
 * event when that happens; Safari does not, which is why the app also repairs
 * a missing subscription when it opens (see use-push-notifications).
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      let key = old && old.options && old.options.applicationServerKey;
      if (!key) {
        const res = await fetch("/api/push/vapid-public-key");
        if (!res.ok) return;
        const { publicKey } = await res.json();
        key = urlBase64ToUint8Array(publicKey);
      }
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (old && old.endpoint && old.endpoint !== sub.endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: old.endpoint }),
        });
      }
    })().catch(() => undefined),
  );
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = self.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Done / Snooze buttons act without opening the app (if that fails, the
 * reminder opens instead). Tapping the notification itself opens the
 * reminder, reusing an open tab if there is one.
 */
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  const target = data.url || "/reminders";

  if ((event.action === "done" || event.action === "snooze") && data.id) {
    event.waitUntil(
      fetch("/api/push/action", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.id, action: event.action }),
      })
        .then((res) => (res.ok ? undefined : self.clients.openWindow(target)))
        .catch(() => self.clients.openWindow(target)),
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if (!("focus" in client)) continue;
        try {
          // navigate() fails for a tab this worker does not control; fall through to a new window.
          const navigated = await client.navigate(target);
          return (navigated || client).focus();
        } catch {
          break;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
