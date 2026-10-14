"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { requestPasswordReset } from "@/lib/auth-client";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  async function onSubmit({ email }: ForgotPasswordValues) {
    const { error } = await requestPasswordReset({ email, redirectTo: "/reset-password" });
    if (error?.status === 429) return setError("root", { message: "Too many attempts. Wait a minute and try again." });
    // Same message whether or not the account exists, so emails cannot be probed.
    setSentTo(email);
  }

  const backLink = (
    <Link href="/sign-in" className="underline-offset-4 hover:text-foreground hover:underline">
      Back to sign in
    </Link>
  );

  if (sentTo) {
    return (
      <AuthCard
        title="Check your inbox"
        description={
          <>
            If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we sent a link to
            reset your password. It expires in 1 hour.
          </>
        }
        footer={backLink}
      >
        <p className="text-sm text-muted-foreground">Nothing there? Check your spam folder.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" description="Enter your email and we will send you a reset link." footer={backLink}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <FormField id="email" label="Email" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register("email")} />
          <FormError message={errors.root?.message} />
          <Button type="submit" size="page" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Send reset link
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
