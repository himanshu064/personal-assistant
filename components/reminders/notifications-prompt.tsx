"use client";

import { BellIcon, ShareIcon, SquarePlusIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * Asks for notification permission when this device is not subscribed. On an
 * iPhone in a Safari tab it explains Add to Home Screen instead, because iOS
 * only allows push for installed web apps.
 */
export function NotificationsPrompt() {
  const push = usePushNotifications();

  if (push.needsHomeScreenInstall) {
    return (
      <Alert>
        <BellIcon />
        <AlertTitle>Get reminders on this iPhone</AlertTitle>
        <AlertDescription>
          <p>iPhone only sends notifications to apps on the Home Screen:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li className="flex-wrap">
              Tap <ShareIcon className="inline size-4 align-text-bottom" aria-label="Share" /> Share in Safari.
            </li>
            <li>
              Choose <SquarePlusIcon className="inline size-4 align-text-bottom" aria-hidden /> Add to Home Screen.
            </li>
            <li>Open the app from your Home Screen and turn on notifications.</li>
          </ol>
        </AlertDescription>
      </Alert>
    );
  }

  if (!push.isSupported || push.isSubscribed) return null;

  if (push.permission === "denied") {
    return (
      <Alert>
        <BellIcon />
        <AlertTitle>Notifications are blocked</AlertTitle>
        <AlertDescription>Allow notifications for this site in your browser settings so reminders can reach you.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <BellIcon />
      <AlertTitle>Turn on notifications</AlertTitle>
      <AlertDescription>So your reminders reach you even when the app is closed.</AlertDescription>
      <AlertAction>
        <Button size="sm" onClick={push.subscribe} disabled={push.busy}>
          {push.busy ? <Spinner /> : null}
          Turn on
        </Button>
      </AlertAction>
    </Alert>
  );
}
