"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { disconnectGmail, syncNow } from "@/app/(app)/inbox/actions";
import { safeAction } from "@/lib/safe-action";

/** "Sync now" and the menu with "Disconnect Gmail" (asks first). */
export function InboxActions({ canSync }: { canSync: boolean }) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      {canSync ? (
        <Button
          size="page"
          variant="outline"
          disabled={syncing}
          onClick={() =>
            startSync(async () => {
              const result = await safeAction(() => syncNow());
              toast.add(result.ok ? { title: result.message, type: "success" } : { title: result.error, type: "error" });
            })
          }
        >
          {syncing ? <Spinner /> : <RefreshCwIcon strokeWidth={1.5} />}
          {syncing ? "Syncing" : "Sync now"}
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="page" variant="outline" aria-label="Gmail options" />}>
          <MoreHorizontalIcon strokeWidth={1.5} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            <UnplugIcon />
            Disconnect Gmail
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal
        open={confirming}
        onOpenChange={(open) => !disconnecting && setConfirming(open)}
        title="Disconnect Gmail?"
        description="The app stops reading your email and removes all suggestions. Reminders you already made stay."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="page" onClick={() => setConfirming(false)} disabled={disconnecting}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="page"
            disabled={disconnecting}
            onClick={() =>
              startDisconnect(async () => {
                const result = await safeAction(() => disconnectGmail());
                if (!result.ok) return void toast.add({ title: result.error, type: "error" });
                setConfirming(false);
                toast.add({ title: "Gmail disconnected", type: "success" });
                router.refresh();
              })
            }
          >
            {disconnecting ? <Spinner /> : <UnplugIcon strokeWidth={1.5} />}
            Disconnect
          </Button>
        </div>
      </ResponsiveModal>
    </>
  );
}
