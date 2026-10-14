"use client";

import { ErrorPanel } from "@/components/common/error-panel";

/** Errors inside the app keep the sidebar and tab bar, so users are never stuck. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <ErrorPanel error={error} retry={retry} homeHref="/home" />
    </main>
  );
}
