"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { savePreferences } from "@/app/(app)/settings/actions";
import type { ModelOption } from "@/lib/ai/list-models";
import { AI_PROVIDERS, PROVIDER_LABELS, type AiProvider } from "@/lib/ai/providers";
import { ALERT_COUNT_LABELS, ALERT_COUNT_OPTIONS, LEAD_TIME_LABELS, LEAD_TIME_OPTIONS } from "@/lib/validation/reminders";
import { preferencesSchema, type PreferencesInput, type PreferencesValues } from "@/lib/validation/settings";
import { safeAction } from "@/lib/safe-action";

const selectClass = "w-full";

export function PreferencesForm({
  catalog,
  initial,
  savedProviders,
}: {
  /** Per provider: its cheapest model, and the models the user's key can use (live from the provider). */
  catalog: Record<AiProvider, { defaultModel: string; models: ModelOption[] }>;
  initial: { timezone: string | null; provider: AiProvider; model: string; defaultLeadMinutes: number; defaultAlertCount: number };
  savedProviders: AiProvider[];
}) {
  const detected = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  // Every timezone the browser knows. Browsers list some zones under older
  // names (Chrome has "Asia/Calcutta" for "Asia/Kolkata"), so the saved and
  // detected values are always added, or the picker would show blank.
  const timezones = useMemo(() => {
    const list = new Set(Intl.supportedValuesOf("timeZone"));
    if (initial.timezone) list.add(initial.timezone);
    list.add(detected);
    return [...list].sort();
  }, [initial.timezone, detected]);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<PreferencesInput, unknown, PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      timezone: initial.timezone ?? detected,
      provider: initial.provider,
      model: initial.model,
      defaultLeadMinutes: initial.defaultLeadMinutes,
      defaultAlertCount: initial.defaultAlertCount,
    },
  });

  const provider = useWatch({ control, name: "provider" });
  const models = catalog[provider].models;

  /** Switching provider picks that provider's default (cheapest) model if the current one is not offered. */
  function onProviderChange(next: AiProvider) {
    if (!catalog[next].models.some((m) => m.id === getValues("model"))) {
      setValue("model", catalog[next].defaultModel, { shouldDirty: true });
    }
  }

  async function onSubmit(values: PreferencesValues) {
    const result = await safeAction(() => savePreferences(values));
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
        <CardContent className="py-2">
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
              <FieldLabel htmlFor="defaultLeadMinutes">Alert me</FieldLabel>
              <NativeSelect id="defaultLeadMinutes" className={selectClass} {...register("defaultLeadMinutes")}>
                {LEAD_TIME_OPTIONS.map((m) => (
                  <NativeSelectOption key={m} value={m}>
                    {LEAD_TIME_LABELS[m]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                For every new reminder, unless you say otherwise, including the ones made from your Gmail. Alerts go out on the quarter hour
                (:00, :15, :30, :45), at the one closest to this time.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="defaultAlertCount">Remind me</FieldLabel>
              <NativeSelect id="defaultAlertCount" className={selectClass} {...register("defaultAlertCount")}>
                {ALERT_COUNT_OPTIONS.map((n) => (
                  <NativeSelectOption key={n} value={n}>
                    {ALERT_COUNT_LABELS[n]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                More than once: extra alerts come 15 minutes apart, ending at the Alert me time. For example, a call at 4:40 with 15 minutes
                and 3 times alerts at 4:00, 4:15 and 4:30. Marking it done stops the rest.
              </FieldDescription>
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
                <FieldDescription>
                  {savedProviders.length > 0 ? `You have a ${PROVIDER_LABELS[savedProviders[0]]} key. Choose it here, or add` : "Add"} a{" "}
                  {PROVIDER_LABELS[provider]} key in{" "}
                  <Link href="/settings/api-keys" className="font-medium text-foreground underline underline-offset-4">
                    AI keys
                  </Link>{" "}
                  to use AI features.
                </FieldDescription>
              )}
            </Field>

            <Field data-invalid={errors.model ? true : undefined}>
              <FieldLabel htmlFor="model">Model</FieldLabel>
              <NativeSelect id="model" className={selectClass} aria-invalid={errors.model ? true : undefined} {...register("model")}>
                {models.map((m) => (
                  <NativeSelectOption key={m.id} value={m.id}>
                    {m.id === catalog[provider].defaultModel ? `${m.id} (default, lowest cost)` : m.label === m.id ? m.id : `${m.label} (${m.id})`}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                {hasKeyForProvider ? "The models your key can use, straight from the provider." : "Add a key to see every model your key can use."}
              </FieldDescription>
              {errors.model ? <FieldError>{errors.model.message}</FieldError> : null}
            </Field>
            <FormError message={errors.root?.message} />
          </FieldGroup>
        </CardContent>
        <div className="flex justify-end px-(--card-spacing) pt-2">
          <Button type="submit" size="page" className="w-full sm:w-auto" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? <Spinner /> : null}
            Save preferences
          </Button>
        </div>
      </form>
    </Card>
  );
}
