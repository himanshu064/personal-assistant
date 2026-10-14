"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { sendVerificationEmail, signIn } from "@/lib/auth-client";
import { safeRedirect, signInSchema, type SignInValues } from "@/lib/validation/auth";

export function SignInForm() {
  const router = useRouter();
  const redirectTo = safeRedirect(useSearchParams().get("redirect"));
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: SignInValues) {
    setUnverifiedEmail(null);
    const { error } = await signIn.email(values);

    if (!error) {
      router.replace(redirectTo);
      router.refresh();
      return;
    }
    if (error.code === "EMAIL_NOT_VERIFIED") {
      setUnverifiedEmail(values.email);
      return;
    }
    // One generic message, so the form does not reveal which emails exist.
    setError("root", {
      message: error.status === 429 ? "Too many attempts. Wait a minute and try again." : "Wrong email or password.",
    });
  }

  async function resend() {
    if (!unverifiedEmail) return;
    setSending(true);
    await sendVerificationEmail({ email: unverifiedEmail, callbackURL: "/verify-email?verified=1" });
    setSending(false);
    setResent(true);
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your assistant."
      footer={
        <span>
          New here?{" "}
          <Link href="/sign-up" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <FormField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="-mt-3 text-right text-sm">
            <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <FormError message={errors.root?.message} />
          {unverifiedEmail ? (
            <div role="alert" className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p>Please confirm your email first. Check your inbox for the link.</p>
              {resent ? (
                <p className="mt-2 text-muted-foreground">Sent. Check your inbox.</p>
              ) : (
                <Button type="button" variant="link" className="mt-1 h-auto p-0" onClick={resend} disabled={sending}>
                  {sending ? <Spinner /> : null}
                  {sending ? "Sending" : "Send the link again"}
                </Button>
              )}
            </div>
          ) : null}
          <Button type="submit" size="page" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Sign in
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
