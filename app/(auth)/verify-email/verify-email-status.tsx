"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
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

  if (params.get("verified")) {
    return (
      <AuthCard title="Email confirmed" description="Your account is ready.">
        <Link href="/" className={buttonVariants({ size: "lg", className: "h-11 w-full" })}>
          Open my assistant
        </Link>
      </AuthCard>
    );
  }

  if (params.get("error")) {
    return (
      <AuthCard title="This link has expired" description="Sign in and we will offer to send you a new one.">
        <Link href="/sign-in" className={buttonVariants({ size: "lg", className: "h-11 w-full" })}>
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  async function resend() {
    if (!email) return;
    await sendVerificationEmail({ email, callbackURL: "/verify-email?verified=1" });
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
          <Button variant="outline" size="lg" className="h-11 w-full" onClick={resend}>
            Send the link again
          </Button>
        )
      ) : null}
    </AuthCard>
  );
}
