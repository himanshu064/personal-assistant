"use client";

import { useState } from "react";
import { CalendarClockIcon, EyeIcon, MailIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { GMAIL_SCOPE } from "@/lib/gmail/scope";

/** Sends the user to Google to allow read only Gmail access, then back to the Inbox. */
export function useConnectGmail() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setConnecting(true);
    setError(null);
    const { error } = await authClient.linkSocial({
      provider: "google",
      scopes: [GMAIL_SCOPE],
      callbackURL: "/inbox?connected=1",
      errorCallbackURL: "/inbox?gmail_error=1",
    });
    // On success the browser is already leaving for Google.
    if (!error) return null;
    const message = error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Could not open Google. Try again.";
    setConnecting(false);
    setError(message);
    return message;
  }

  return { connect, connecting, error };
}

const POINTS = [
  { icon: CalendarClockIcon, text: "Finds meeting invites, appointments and deadlines in your email." },
  { icon: EyeIcon, text: "Read only. The app never sends, deletes or changes your mail." },
  { icon: ShieldCheckIcon, text: "Meeting invites become reminders by themselves. Everything else waits until you tap Create reminder." },
];

/** Better Auth sends ?error=<code> back when linking fails. */
const LINK_ERRORS: Record<string, string> = {
  access_denied: "Gmail was not connected because access was not allowed on Google's screen.",
  account_already_linked_to_different_user: "That Gmail is already connected to another account in this app.",
};

/** The message for a failed connect, from Better Auth's ?error=<code>. */
export function linkErrorMessage(errorCode?: string) {
  return (
    (errorCode && LINK_ERRORS[errorCode]) ??
    "Gmail was not connected. If Google said access was blocked, ask the app owner to add your address as a test user."
  );
}

export function ConnectGmail({ failed, errorCode }: { failed?: boolean; errorCode?: string }) {
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
          Your assistant checks your email every few minutes and suggests reminders for what matters. You can connect more than one Gmail.
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
      <Button size="page" onClick={connect} disabled={connecting}>
        {connecting ? <Spinner /> : <MailIcon strokeWidth={1.5} />}
        Connect Gmail
      </Button>
      {message ? (
        <p role="alert" className="max-w-md text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
