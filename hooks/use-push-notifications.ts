'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { toast } from '@/components/ui/toast';

/**
 * Web push subscription for this browser.
 *
 * Being subscribed and being *allowed* are different states: a user can revoke
 * notification permission in browser settings while a subscription row still
 * exists on the server. Both are reported so the UI can say which is wrong.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export interface PushState {
  isSupported: boolean;
  /**
   * An iPhone or iPad in a Safari tab. Safari only exposes PushManager to a
   * Home Screen web app, so here `isSupported` is false for a reason the
   * user can fix (install the app), and the UI should say so rather than
   * "not supported".
   */
  needsHomeScreenInstall: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  busy: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

type Snapshot = Pick<
  PushState,
  'isSupported' | 'needsHomeScreenInstall' | 'permission' | 'isSubscribed' | 'busy'
>;

/**
 * One store shared by every mounted instance of the hook, so a toggle in
 * Settings and a prompt on another screen always agree about whether this
 * device is subscribed.
 */
const initialSnapshot: Snapshot = {
  isSupported: false,
  needsHomeScreenInstall: false,
  permission: 'default',
  isSubscribed: false,
  busy: false,
};
let snapshot: Snapshot = initialSnapshot;
const listeners = new Set<() => void>();
let initialised = false;

function setSnapshot(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

function subscribeToStore(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return initialSnapshot;
}

/**
 * Remembers that the user switched notifications off themselves. Turning them
 * off keeps browser permission granted, so without this the repair below
 * would quietly switch them back on at the next open.
 */
const USER_DISABLED_KEY = 'push:user-disabled';

function userDisabled(): boolean {
  try {
    return window.localStorage.getItem(USER_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function setUserDisabled(value: boolean) {
  try {
    if (value) window.localStorage.setItem(USER_DISABLED_KEY, '1');
    else window.localStorage.removeItem(USER_DISABLED_KEY);
  } catch {
    // A preference is not worth failing over.
  }
}

function isIosBrowserTab(): boolean {
  // iPadOS reports itself as a Mac; the touch points give it away.
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function initialise() {
  if (initialised) return;
  initialised = true;
  const supported =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  setSnapshot({ isSupported: supported });
  if (!supported) {
    setSnapshot({ needsHomeScreenInstall: isIosBrowserTab() });
    return;
  }

  setSnapshot({ permission: Notification.permission });
  navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then(async (sub) => {
      setSnapshot({ isSubscribed: Boolean(sub) });
      if (Notification.permission !== 'granted' || userDisabled()) return;

      // Permission still granted but the subscription is gone: the push
      // service retired the endpoint, or iOS revoked it. Re-subscribing needs
      // no prompt and no tap once permission is granted: WebKit's
      // PushManager::subscribe only demands a user gesture while permission is
      // still "default". So do it here rather than showing the bell "off"
      // and waiting for a tap. Should it fail anyway, it fails quietly and the
      // bell stays off for the user to tap, exactly as before.
      if (!sub) return subscribe({ quiet: true });

      // Permission granted AND a local subscription object exists, but that
      // object only means the BROWSER still thinks it's subscribed. If our
      // own server discovered this endpoint is dead (a 404/410 on an actual
      // send, see pushToDevices() in lib/push/service.ts), nothing tells the browser that happened:
      // pushManager.getSubscription() keeps returning the same useless
      // object forever, so the `!sub` repair above never fires for this case.
      // Ask the server directly, and if it agrees the endpoint is dead,
      // unsubscribe locally first so the next subscribe() is forced to mint a
      // genuinely new endpoint rather than handing back the same dead one.
      try {
        const res = await fetch('/api/push/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (!res.ok) return;
        const { active } = await res.json();
        if (active) return;
        await sub.unsubscribe().catch(() => undefined);
        return subscribe({ quiet: true });
      } catch {
        // A failed check is not evidence the endpoint is dead; do nothing
        // rather than force an unsubscribe/resubscribe over a flaky network.
      }
    })
    .catch(() => undefined);
}

/**
 * Both actions report their outcome with a toast so every button that calls
 * them confirms what happened without
 * repeating the messages.
 */
async function subscribe({ quiet = false }: { quiet?: boolean } = {}) {
  setSnapshot({ busy: true });
  try {
    // Only prompt when there is something to decide. Once granted, a prompt
    // is pointless, and on iOS it is the prompt, not subscribe(), that needs
    // a user gesture, so the on-open repair must not ask.
    const result =
      Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    setSnapshot({ permission: result });
    if (result === 'denied') {
      toast.add({ type: 'error', title: 'Notifications are blocked for this site. Turn them on in your browser settings.' });
      return;
    }
    if (result !== 'granted') {
      toast.add({ type: 'info', title: 'Notifications were not turned on. Allow them when your browser asks.' });
      return;
    }

    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) throw new Error('Push notifications are not configured on the server');
    const { publicKey } = await keyRes.json();

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const saved = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!saved.ok) {
      // The server will never push to this endpoint, so the browser must not
      // keep it either, or the bell says "on" and nothing ever arrives.
      await sub.unsubscribe().catch(() => undefined);
      const { error } = await saved.json().catch(() => ({ error: null }));
      throw new Error(typeof error === 'string' ? error : 'Could not save the subscription');
    }

    setSnapshot({ isSubscribed: true });
    setUserDisabled(false);
    // The on-open repair is housekeeping: the user did nothing, so a toast
    // only announces a problem they never saw. Only a tap gets confirmation.
    if (!quiet) toast.add({ type: 'success', title: 'Notifications turned on for this device' });
  } catch (error) {
    console.error('Push subscribe failed', error);
    // A quiet repair that fails is not the user's problem to read about either.
    if (!quiet) {
      toast.add({ type: 'error', title: error instanceof Error ? error.message : 'Could not turn on notifications' });
    }
  } finally {
    setSnapshot({ busy: false });
  }
}

async function unsubscribe() {
  setSnapshot({ busy: true });
  setUserDisabled(true);
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) {
      setSnapshot({ isSubscribed: false });
      toast.add({ type: 'success', title: 'Notifications turned off for this device' });
      return;
    }

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    setSnapshot({ isSubscribed: false });
    toast.add({ type: 'success', title: 'Notifications turned off for this device' });
  } catch (error) {
    console.error('Push unsubscribe failed', error);
    toast.add({ type: 'error', title: error instanceof Error ? error.message : 'Could not turn off notifications' });
  } finally {
    setSnapshot({ busy: false });
  }
}

export function usePushNotifications(): PushState {
  useEffect(initialise, []);
  const state = useSyncExternalStore(subscribeToStore, getSnapshot, getServerSnapshot);
  return { ...state, subscribe: () => subscribe(), unsubscribe };
}
