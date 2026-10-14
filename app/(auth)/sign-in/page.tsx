import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  // The form reads ?redirect= from the URL, so it renders behind Suspense.
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
