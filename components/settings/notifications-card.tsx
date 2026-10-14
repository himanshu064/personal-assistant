"use client";

import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/** Notifications on or off for this device. Other devices keep their own setting. */
export function NotificationsCard() {
  const push = usePushNotifications();

  let description = "Reminders arrive as notifications on this device.";
  if (push.needsHomeScreenInstall) description = "On iPhone, add this app to your Home Screen first, then turn notifications on there.";
  else if (!push.isSupported) description = "This browser cannot show notifications.";
  else if (push.permission === "denied") description = "Blocked in your browser settings. Allow notifications for this site to turn them on.";

  const disabled = !push.isSupported || push.permission === "denied" || push.busy;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <label htmlFor="push-switch">Notifications on this device</label>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="flex items-center gap-2">
          {push.busy ? <Spinner className="text-muted-foreground" /> : null}
          <Switch
            id="push-switch"
            checked={push.isSubscribed}
            disabled={disabled}
            onCheckedChange={(on) => (on ? push.subscribe() : push.unsubscribe())}
          />
        </CardAction>
      </CardHeader>
    </Card>
  );
}
