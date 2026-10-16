"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClockIcon, EyeIcon, MailIcon, SettingsIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Sends the user to Google (through /api/gmail/connect, with their own Google
 * app) to allow read only Gmail access, then back to the Inbox. Without a
 * Google app saved, that route opens Settings > Google instead.
 */
export function useConnectGmail() {
  const [connecting, setConnecting] = useState(false);

  async function connect(): Promise<string | null> {
    setConnecting(true);
    // A full page load, not router.push: the route redirects off site to Google's consent screen.
    window.location.assign(new URL("/api/gmail/connect", window.location.origin));
    return null;
  }

  return { connect, connecting, error: null as string | null };
}

const POINTS = [
  { icon: CalendarClockIcon, text: "Finds meeting invites, appointments and deadlines in your email." },
  { icon: EyeIcon, text: "Read only. The app never sends, deletes or changes your mail." },
  { icon: ShieldCheckIcon, text: "Anything with a date becomes a reminder by itself. Emails without a date wait here for you." },
];

/** /api/gmail/callback sends ?error=<code> back when connecting fails. */
const LINK_ERRORS: Record<string, string> = {
  access_denied: "Gmail was not connected because access was not allowed on Google's screen.",
  state_mismatch: "That sign in took too long or was opened in another tab. Try Connect Gmail again.",
  no_client: "Set up your Google app in Settings > Google first.",
  exchange_failed:
    "Google did not finish connecting. Check your Google app in Settings > Google (Test connection), and that the Redirect URL is added in Google Cloud.",
};

/** The message for a failed connect, from Better Auth's ?error=<code>. */
export function linkErrorMessage(errorCode?: string) {
  return (
    (errorCode && LINK_ERRORS[errorCode]) ??
    "Gmail was not connected. If Google said access was blocked, ask the app owner to add your address as a test user."
  );
}

export function ConnectGmail({ failed, errorCode, googleReady }: { failed?: boolean; errorCode?: string; googleReady: boolean }) {
  const { connect, connecting, error } = useConnectGmail();
  const message = error ?? (failed ? linkErrorMessage(errorCode) : null);

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl bg-card px-6 py-12 text-center framed">
      <span className="flex size-12 items-center justify-center rounded-full border bg-background">
        <MailIcon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-xl tracking-tight">Connect your Gmail</h2>
        <p className="text-sm text-muted-foreground">
          Your assistant checks your email every morning at 6 AM (or when you tap Sync now) and suggests reminders for what matters. You can connect more than one Gmail.
        </p>
      </div>
      <ul className="flex max-w-md flex-col gap-3 text-left text-sm">
        {POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      {googleReady ? (
        <Button size="page" onClick={connect} disabled={connecting}>
          {connecting ? <Spinner /> : <MailIcon strokeWidth={1.5} />}
          Connect Gmail
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="max-w-md text-sm text-muted-foreground">First, set up your own Google app (about 5 minutes, steps included).</p>
          <Button size="page" nativeButton={false} render={<Link href="/settings/google" />}>
            <SettingsIcon strokeWidth={1.5} />
            Set up Google app
          </Button>
        </div>
      )}
      {message ? (
        <p role="alert" className="max-w-md text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
