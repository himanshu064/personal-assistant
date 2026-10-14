"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";

/**
 * While a sync runs, refreshes the page every few seconds (for up to two
 * minutes) so suggestions appear without a reload. Also confirms a fresh
 * connection once, then removes ?connected=1 from the URL.
 */
export function SyncWatcher({ syncing, justConnected }: { syncing: boolean; justConnected: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!justConnected) return;
    toast.add({ title: "Gmail connected. Reading your last 30 days.", type: "success" });
    const url = new URL(window.location.href);
    url.searchParams.delete("connected");
    window.history.replaceState(null, "", url);
  }, [justConnected]);

  useEffect(() => {
    if (!syncing) return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 120_000) return clearInterval(timer);
      router.refresh();
    }, 4_000);
    return () => clearInterval(timer);
  }, [syncing, router]);

  return null;
}
