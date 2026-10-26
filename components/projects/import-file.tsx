"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

/** Same limit as the import route (MAX_IMPORT_BYTES): checked here first, so a big file is not uploaded for nothing. */
const MAX_BYTES = 4_000_000;

/**
 * Picks an exported .json file and imports it, then opens what it made.
 * `into`: "projects" (a project file becomes a new project), "chat" (a chat
 * file becomes a quick chat) or a project id (a chat file joins that project).
 */
export function useImportFile(into: string) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) return void toast.add({ title: "That file is too big to import (4 MB at most).", type: "error" });
    setBusy(true);
    try {
      const res = await fetch(`/api/import?into=${encodeURIComponent(into)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await file.text(),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; projectId?: string | null; threadId?: string | null } | null;
      if (!res.ok || !data?.ok) return void toast.add({ title: data?.error ?? "The import did not work. Try again.", type: "error" });

      toast.add({ title: into === "projects" ? "Project imported" : "Chat imported", type: "success" });
      if (into === "projects") router.push(`/projects/${data.projectId}`);
      else if (data.projectId) router.push(`/projects/${data.projectId}?thread=${data.threadId}`);
      else router.push(`/chat?thread=${data.threadId}`);
      // The browser may still hold the list from before the import.
      router.refresh();
    } catch {
      toast.add({ title: "Could not reach the app. Check your connection and try again.", type: "error" });
    } finally {
      setBusy(false);
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Cleared, so picking the same file again still imports it.
        e.target.value = "";
        if (file) void upload(file);
      }}
    />
  );
  return { open: () => inputRef.current?.click(), busy, input };
}

/** Saves an export (the route answers with a file, so the page stays where it is). */
export function downloadExport(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.click();
}

export function ImportButton({ into, label }: { into: string; label: string }) {
  const { open, busy, input } = useImportFile(into);
  return (
    <>
      <Button size="page" variant="outline" onClick={open} disabled={busy}>
        {busy ? <Spinner /> : <UploadIcon strokeWidth={1.5} />}
        {label}
      </Button>
      {input}
    </>
  );
}
