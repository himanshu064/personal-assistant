"use client";

import { ErrorPanel } from "@/components/common/error-panel";

/** Errors outside the app (landing, auth screens), on the warm canvas. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar px-4 py-16">
      <ErrorPanel error={error} retry={retry} homeHref="/" />
    </main>
  );
}
