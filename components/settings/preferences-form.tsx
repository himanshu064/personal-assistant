"use client";

import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { savePreferences } from "@/app/(app)/settings/actions";
import type { ModelCatalog } from "@/lib/ai/models";
import { AI_PROVIDERS, PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { preferencesSchema, type PreferencesValues } from "@/lib/validation/settings";

const selectClass = "w-full [&_select]:h-11 [&_select]:text-base md:[&_select]:h-9 md:[&_select]:text-sm";

export function PreferencesForm({
  catalog,
  initial,
  savedProviders,
}: {
  catalog: ModelCatalog;
  initial: { timezone: string | null; provider: AiProvider; model: string };
  savedProviders: AiProvider[];
}) {
  // Every timezone the browser knows, for the picker.
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const detected = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: { timezone: initial.timezone ?? detected, provider: initial.provider, model: initial.model },
  });

  const provider = useWatch({ control, name: "provider" });
  const models = catalog.providers[provider].models;

  /** Switching provider picks that provider's default (cheapest) model if the current one is not offered. */
  function onProviderChange(next: AiProvider) {
    if (!catalog.providers[next].models.includes(getValues("model"))) {
      setValue("model", catalog.providers[next].defaultModel, { shouldDirty: true });
    }
  }

  async function onSubmit(values: PreferencesValues) {
    const result = await savePreferences(values);
    if (!result.ok) {
      setError(result.field === "timezone" || result.field === "model" ? result.field : "root", { message: result.error });
      return;
    }
    reset(values);
    toast.add({ title: result.message, type: "success" });
  }

  const hasKeyForProvider = savedProviders.includes(provider);

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Used for reminder times and every AI feature.</CardDescription>
        </CardHeader>
        <CardContent className="py-4">
          <FieldGroup>
            <Field data-invalid={errors.timezone ? true : undefined}>
              <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
              <NativeSelect id="timezone" className={selectClass} aria-invalid={errors.timezone ? true : undefined} {...register("timezone")}>
                {timezones.map((tz) => (
                  <NativeSelectOption key={tz} value={tz}>
                    {tz.replaceAll("_", " ")}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {initial.timezone ? null : <FieldDescription>Detected from this device.</FieldDescription>}
              {errors.timezone ? <FieldError>{errors.timezone.message}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="provider">AI provider</FieldLabel>
              <NativeSelect id="provider" className={selectClass} {...register("provider", { onChange: (e) => onProviderChange(e.target.value as AiProvider) })}>
                {AI_PROVIDERS.map((p) => (
                  <NativeSelectOption key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {hasKeyForProvider ? null : (
                <FieldDescription>Add a {PROVIDER_LABELS[provider]} key below to use AI features.</FieldDescription>
              )}
            </Field>

            <Field data-invalid={errors.model ? true : undefined}>
              <FieldLabel htmlFor="model">Model</FieldLabel>
              <NativeSelect id="model" className={selectClass} aria-invalid={errors.model ? true : undefined} {...register("model")}>
                {models.map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {m === catalog.providers[provider].defaultModel ? `${m} (default, lowest cost)` : m}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {errors.model ? <FieldError>{errors.model.message}</FieldError> : null}
            </Field>
            <FormError message={errors.root?.message} />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" className="h-11 w-full sm:h-9 sm:w-auto" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Spinner /> : null}
            Save preferences
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
