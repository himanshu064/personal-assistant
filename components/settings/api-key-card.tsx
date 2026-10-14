"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { deleteApiKey, saveApiKey } from "@/app/(app)/settings/actions";
import { PROVIDER_KEY_URLS, PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { apiKeySchema, type ApiKeyValues } from "@/lib/validation/settings";
import { safeAction } from "@/lib/safe-action";

export function ApiKeyCard({
  provider,
  saved,
}: {
  provider: AiProvider;
  saved: { last4: string; updatedAt: Date } | null;
}) {
  const [editing, setEditing] = useState(!saved);
  const [removing, setRemoving] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyValues>({ resolver: zodResolver(apiKeySchema), defaultValues: { provider, apiKey: "" } });

  async function onSubmit(values: ApiKeyValues) {
    const result = await safeAction(() => saveApiKey(values));
    if (!result.ok) return setError("apiKey", { message: result.error });
    reset({ provider, apiKey: "" });
    setEditing(false);
    toast.add({ title: result.message, type: "success" });
  }

  async function remove() {
    setRemoving(true);
    const result = await safeAction(() => deleteApiKey({ provider }));
    setRemoving(false);
    if (!result.ok) return toast.add({ title: result.error, type: "error" });
    setEditing(true);
    toast.add({ title: result.message, type: "success" });
  }

  const inputId = `${provider}-api-key`;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{PROVIDER_LABELS[provider]}</CardTitle>
        <CardDescription>
          {saved && !editing ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2Icon className="size-4 text-emerald-600" aria-hidden />
              Key saved, ending in <span className="font-mono">{saved.last4}</span>
            </span>
          ) : (
            <a
              href={PROVIDER_KEY_URLS[provider]}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
            >
              Get a key
              <ExternalLinkIcon className="size-3.5" aria-hidden />
            </a>
          )}
        </CardDescription>
        {saved && !editing ? (
          <CardAction className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={remove} disabled={removing}>
              {removing ? <Spinner /> : null}
              Remove
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      {editing ? (
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FormField
                id={inputId}
                label="API key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={provider === "anthropic" ? "sk-ant-..." : "AIza..."}
                error={errors.apiKey?.message}
                {...register("apiKey")}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="page" className="flex-1 sm:flex-none" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null}
                {isSubmitting ? "Checking" : "Save key"}
              </Button>
              {saved ? (
                <Button type="button" variant="ghost" size="page" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}
