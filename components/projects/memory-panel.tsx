"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BrainIcon, PencilIcon } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { EmptyState } from "@/components/common/empty-state";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { saveMemory } from "@/app/(app)/projects/actions";
import { safeAction } from "@/lib/safe-action";
import { formatRelative } from "@/lib/time";
import { memorySchema, type MemoryValues } from "@/lib/validation/projects";

/**
 * What the assistant remembers about the project. It is written by the AI
 * after each reply; the user can read it and fix anything wrong.
 */
export function MemoryPanel({ projectId, memory, updatedAt }: { projectId: string; memory: string; updatedAt: Date | null }) {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What I remember</CardTitle>
        <CardDescription>
          Every chat in this project uses this. It updates by itself after each reply
          {updatedAt ? `, last ${formatRelative(new Date(updatedAt))}` : ""}. Edit it to fix anything wrong.
        </CardDescription>
        {!editing ? (
          <CardAction>
            <Button size="page" variant="outline" onClick={() => setEditing(true)}>
              <PencilIcon strokeWidth={1.5} />
              {memory ? "Edit" : "Write it yourself"}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {editing ? (
          <MemoryForm projectId={projectId} memory={memory} onDone={() => setEditing(false)} />
        ) : memory ? (
          <Markdown className="max-w-3xl">{memory}</Markdown>
        ) : (
          <EmptyState
            icon={BrainIcon}
            title="Nothing remembered yet"
            description="Tell the assistant something in a chat, for example who paid what, and it shows up here."
            action={
              <Button size="page" nativeButton={false} render={<Link href={`/projects/${projectId}`} />}>
                Open chats
              </Button>
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function MemoryForm({ projectId, memory, onDone }: { projectId: string; memory: string; onDone: () => void }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MemoryValues>({ resolver: zodResolver(memorySchema), defaultValues: { memory } });

  async function submit(values: MemoryValues) {
    const result = await safeAction(() => saveMemory(projectId, values));
    if (!result.ok) return setError("root", { message: result.error });
    toast.add({ title: values.memory ? "Memory saved" : "Memory cleared", type: "success" });
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex max-w-3xl flex-col gap-4">
      <Field data-invalid={errors.memory ? true : undefined}>
        <Textarea aria-label="Memory" className="min-h-80 font-mono text-sm" autoFocus {...register("memory")} />
        <FieldDescription>Plain text or Markdown. Leave it empty to make the assistant forget everything in this project.</FieldDescription>
        {errors.memory ? <FieldError>{errors.memory.message}</FieldError> : null}
      </Field>
      <FormError message={errors.root?.message} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="page" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="page" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : null}
          Save memory
        </Button>
      </div>
    </form>
  );
}
