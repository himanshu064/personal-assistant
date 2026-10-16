"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { FormField } from "@/components/auth/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { deleteApiKey, saveApiKey, selectApiKey } from "@/app/(app)/settings/actions";
import { PROVIDER_KEY_URLS, PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { apiKeySchema, type ApiKeyValues } from "@/lib/validation/settings";
import { safeAction } from "@/lib/safe-action";

export type SavedKey = { id: string; label: string; last4: string; isActive: boolean };

/**
 * One provider's keys. The key in use for the selected provider is marked
 * "In use"; the other provider's chosen key is its "Default". "Use this key"
 * also switches the provider, so the key tapped is always the one used.
 */
export function ApiKeyCard({ provider, selected, keys }: { provider: AiProvider; selected: boolean; keys: SavedKey[] }) {
  const [adding, setAdding] = useState(keys.length === 0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApiKeyValues>({ resolver: zodResolver(apiKeySchema), defaultValues: { provider, label: "", apiKey: "" } });

  async function onSubmit(values: ApiKeyValues) {
    const result = await safeAction(() => saveApiKey(values));
    if (!result.ok) return setError(result.field === "label" ? "label" : "apiKey", { message: result.error });
    reset({ provider, label: "", apiKey: "" });
    setAdding(false);
    toast.add({ title: result.message, type: "success" });
  }

  async function run(id: string, action: typeof selectApiKey) {
    setBusyId(id);
    const result = await safeAction(() => action({ id }));
    setBusyId(null);
    toast.add({ title: result.ok ? result.message : result.error, type: result.ok ? "success" : "error" });
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{PROVIDER_LABELS[provider]}</CardTitle>
        <CardDescription>
          <a
            href={PROVIDER_KEY_URLS[provider]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
          >
            Get a key
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
        </CardDescription>
        {!adding ? (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <PlusIcon />
              Add key
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {keys.length > 0 ? (
          <ul className="flex flex-col divide-y divide-dashed">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                  <KeyRoundIcon className="size-4 text-muted-foreground" strokeWidth={1.5} aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px]">{k.label}</span>
                  <span className="text-xs text-muted-foreground">
                    Ends in <span className="font-mono">{k.last4}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {k.isActive ? (
                    <Badge variant={selected ? "success" : "neutral"}>{selected ? "In use" : "Default"}</Badge>
                  ) : null}
                  {!(k.isActive && selected) ? (
                    <Button variant="outline" size="sm" onClick={() => run(k.id, selectApiKey)} disabled={busyId !== null}>
                      {busyId === k.id ? <Spinner /> : null}
                      Use this key
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(k.id, deleteApiKey)}
                    disabled={busyId !== null}
                    aria-label={`Remove ${k.label}`}
                  >
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {adding ? (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="sm:w-40">
              <FormField
                id={`${provider}-key-label`}
                label="Name (optional)"
                autoComplete="off"
                placeholder="Work"
                error={errors.label?.message}
                {...register("label")}
              />
            </div>
            <div className="flex-1">
              <FormField
                id={`${provider}-api-key`}
                label="API key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={provider === "anthropic" ? "sk-ant-..." : "AIza..."}
                error={errors.apiKey?.message}
                {...register("apiKey")}
              />
            </div>
            <div className="flex gap-2 sm:pt-[26px]">
              <Button type="submit" size="page" className="flex-1 sm:flex-none" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : null}
                {isSubmitting ? "Checking" : "Save key"}
              </Button>
              {keys.length > 0 ? (
                <Button type="button" variant="ghost" size="page" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
