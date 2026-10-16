"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailPlusIcon, MoreHorizontalIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { ResponsiveModal } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { disconnectGmail, syncNow } from "@/app/(app)/inbox/actions";
import { safeAction } from "@/lib/safe-action";
import { useConnectGmail } from "./connect-gmail";

type Account = { accountId: string; email: string | null };

/** "Sync now" (every Gmail) and the menu: "Add another Gmail", and "Disconnect" per Gmail (asks first). */
export function InboxActions({ canSync, accounts }: { canSync: boolean; accounts: Account[] }) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [confirming, setConfirming] = useState<Account | null>(null);
  const { connect, connecting } = useConnectGmail();

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
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={() => void connect().then((message) => message && toast.add({ title: message, type: "error" }))} disabled={connecting}>
            <MailPlusIcon />
            Add another Gmail
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {accounts.map((a) => (
            <DropdownMenuItem key={a.accountId} variant="destructive" onClick={() => setConfirming(a)}>
              <UnplugIcon />
              <span className="truncate">Disconnect {a.email ?? "Gmail"}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal
        open={confirming !== null}
        onOpenChange={(open) => !disconnecting && !open && setConfirming(null)}
        title={`Disconnect ${confirming?.email ?? "Gmail"}?`}
        description="The app stops reading this Gmail and removes its suggestions. Reminders you already made stay, and other Gmails stay connected."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" size="page" onClick={() => setConfirming(null)} disabled={disconnecting}>
            Keep it
          </Button>
          <Button
            variant="destructive"
            size="page"
            disabled={disconnecting}
            onClick={() =>
              startDisconnect(async () => {
                if (!confirming) return;
                const result = await safeAction(() => disconnectGmail(confirming.accountId));
                if (!result.ok) return void toast.add({ title: result.error, type: "error" });
                setConfirming(null);
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
