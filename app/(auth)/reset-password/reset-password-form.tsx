"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { FormField } from "@/components/auth/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { resetPassword } from "@/lib/auth-client";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(Boolean(params.get("error")) || !token);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    if (!token) return;
    const { error } = await resetPassword({ newPassword: values.password, token });
    if (!error) return setDone(true);
    if (error.code === "INVALID_TOKEN") return setExpired(true);
    setError("root", { message: "We could not reset your password. Try again." });
  }

  if (expired) {
    return (
      <AuthCard title="This link has expired" description="Reset links work once and expire after 1 hour.">
        <Link href="/forgot-password" className={buttonVariants({ size: "lg", className: "h-11 w-full" })}>
          Get a new link
        </Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated" description="You have been signed out everywhere. Sign in with your new password.">
        <Link href="/sign-in" className={buttonVariants({ size: "lg", className: "h-11 w-full" })}>
          Sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" description="At least 8 characters.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <FormField id="password" label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <FormField id="confirm" label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
          <FormError message={errors.root?.message} />
          <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Update password
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
