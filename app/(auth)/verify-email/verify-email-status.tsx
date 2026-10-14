"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { sendVerificationEmail } from "@/lib/auth-client";

/**
 * Three states, from the URL:
 * - ?verified=1  the link worked (Better Auth already signed the user in)
 * - ?error=...   the link was invalid or expired
 * - ?email=...   just signed up, waiting for the user to open the email
 */
export function VerifyEmailStatus() {
  const params = useSearchParams();
  const email = params.get("email");
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  if (params.get("verified")) {
    return (
      <AuthCard title="Email confirmed" description="Your account is ready.">
        <Link href="/home" className={buttonVariants({ size: "page", className: "w-full" })}>
          Open my assistant
        </Link>
      </AuthCard>
    );
  }

  if (params.get("error")) {
    return (
      <AuthCard title="This link has expired" description="Sign in and we will offer to send you a new one.">
        <Link href="/sign-in" className={buttonVariants({ size: "page", className: "w-full" })}>
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  async function resend() {
    if (!email) return;
    setSending(true);
    setResendError(null);
    const { error } = await sendVerificationEmail({ email, callbackURL: "/verify-email?verified=1" });
    setSending(false);
    if (error) return setResendError(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Could not send it. Try again.");
    setResent(true);
  }

  return (
    <AuthCard
      title="Check your inbox"
      description={
        email ? (
          <>
            We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Open it on
            this device to finish signing up.
          </>
        ) : (
          "We sent you a confirmation link. Open it on this device to finish signing up."
        )
      }
      footer={
        <Link href="/sign-in" className="underline-offset-4 hover:text-foreground hover:underline">
          Back to sign in
        </Link>
      }
    >
      {email ? (
        resent ? (
          <p className="text-sm text-muted-foreground">Sent again. It can take a minute to arrive.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="page" className="w-full" onClick={resend} disabled={sending}>
              {sending ? <Spinner /> : null}
              {sending ? "Sending" : "Send the link again"}
            </Button>
            {resendError ? (
              <p role="alert" className="text-center text-sm text-destructive">
                {resendError}
              </p>
            ) : null}
          </div>
        )
      ) : null}
    </AuthCard>
  );
}
