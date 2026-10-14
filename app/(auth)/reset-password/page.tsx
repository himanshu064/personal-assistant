import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  // The form reads ?token= from the URL, so it renders behind Suspense.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
