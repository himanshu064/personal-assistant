"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Shared body for error.tsx files: what happened, try again, or go home. */
export function ErrorPanel({ error, retry, homeHref }: { error: Error & { digest?: string }; retry: () => void; homeHref: string }) {
  const [retrying, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-card px-6 py-10 text-center framed">
      <span className="flex size-11 items-center justify-center rounded-full border bg-background">
        <TriangleAlertIcon className="size-5 text-muted-foreground" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="text-2xl tracking-tight">This page could not load</h2>
      <p className="text-[15px] text-muted-foreground">
        Something went wrong on our side or with the connection. Your data is safe. Try again in a moment.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Button size="page" onClick={() => startTransition(retry)} disabled={retrying}>
          {retrying ? <Spinner /> : <RotateCwIcon strokeWidth={1.5} />}
          Try again
        </Button>
        <Button size="page" variant="outline" nativeButton={false} render={<Link href={homeHref} />}>
          Go to Home
        </Button>
      </div>
    </div>
  );
}
