"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthCard } from "@/components/auth/auth-card";
import { FormError } from "@/components/auth/form-error";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { signUp } from "@/lib/auth-client";
import { signUpSchema, type SignUpValues } from "@/lib/validation/auth";

export function SignUpForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onSubmit(values: SignUpValues) {
    const { error } = await signUp.email({ ...values, callbackURL: "/verify-email?verified=1" });
    if (error) {
      if (error.status === 429) return setError("root", { message: "Too many attempts. Wait a minute and try again." });
      if (error.code === "PASSWORD_TOO_SHORT") return setError("password", { message: "Use at least 8 characters." });
      return setError("root", { message: "We could not create your account. Try a different email or sign in." });
    }
    router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <AuthCard
      title="Create your account"
      description="Reminders, inbox and project notes, all by voice."
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <FormField id="name" label="Name" autoComplete="name" error={errors.name?.message} {...register("name")} />
          <FormField id="email" label="Email" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register("email")} />
          <div className="flex flex-col gap-2">
            <FormField id="password" label="Password" type="password" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
            {errors.password ? null : <FieldDescription>At least 8 characters.</FieldDescription>}
          </div>
          <FormError message={errors.root?.message} />
          <Button type="submit" size="page" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Create account
          </Button>
        </FieldGroup>
      </form>
    </AuthCard>
  );
}
