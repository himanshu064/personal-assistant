"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConnectGmail } from "./connect-gmail";

/** Shown when Google stopped the connection; suggestions already found stay visible. */
export function ReconnectBanner({ problem }: { problem: string | null }) {
  const { connect, connecting, error } = useConnectGmail();
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-[#f3d3bf] bg-[#fdf4ee] p-4 sm:flex-row sm:items-center">
      <TriangleAlertIcon className="size-5 shrink-0 text-[#d2642a]" strokeWidth={1.5} aria-hidden />
      <div className="flex flex-1 flex-col gap-0.5 text-sm">
        <p className="font-medium">Reconnect Gmail to keep getting suggestions</p>
        <p className="text-muted-foreground">{error ?? problem ?? "Gmail access ended. Reconnect to continue."}</p>
      </div>
      <Button size="page" variant="outline" onClick={connect} disabled={connecting} className="shrink-0">
        {connecting ? <Spinner /> : null}
        Reconnect Gmail
      </Button>
    </div>
  );
}
