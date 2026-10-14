"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SparklesIcon } from "lucide-react";
import { FormError } from "@/components/auth/form-error";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_TIME_LABELS,
  LEAD_TIME_OPTIONS,
  reminderFormSchema,
  type ReminderFormInput,
  type ReminderFormValues,
} from "@/lib/validation/reminders";


export type ReminderFormResult = { ok: true } | { ok: false; error: string; field?: string };

/**
 * The preview: what the assistant understood, as editable fields. Nothing is
 * saved until the user taps the submit button.
 */
export function ReminderForm({
  defaultValues,
  timezone,
  heard,
  via,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues: ReminderFormInput;
  timezone: string;
  /** What the user said, shown above the fields so they can compare. */
  heard?: string;
  via?: "ai" | "rules";
  submitLabel: string;
  onSubmit: (values: ReminderFormValues) => Promise<ReminderFormResult>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormInput, unknown, ReminderFormValues>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues,
  });

  async function submit(values: ReminderFormValues) {
    const result = await onSubmit(values);
    if (result.ok) return;
    const field = result.field;
    if (field === "title" || field === "remindAt" || field === "notes" || field === "leadMinutes") {
      setError(field, { message: result.error });
    } else {
      setError("root", { message: result.error });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-4">
      {heard ? (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">You said: </span>
          <span className="italic">&ldquo;{heard}&rdquo;</span>
        </div>
      ) : null}

      <FieldGroup>
        <FormField id="title" label="Remind me to" error={errors.title?.message} {...register("title")} />

        <Field data-invalid={errors.remindAt ? true : undefined}>
          <FieldLabel htmlFor="remindAt">When</FieldLabel>
          <input
            id="remindAt"
            type="datetime-local"
            aria-invalid={errors.remindAt ? true : undefined}
            className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base [color-scheme:light] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-[15px]"
            {...register("remindAt")}
          />
          <FieldDescription>Times are in {timezone.replaceAll("_", " ")}.</FieldDescription>
          {errors.remindAt ? <FieldError>{errors.remindAt.message}</FieldError> : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="leadMinutes">Alert me</FieldLabel>
          <NativeSelect id="leadMinutes" className="w-full" {...register("leadMinutes")}>
            {LEAD_TIME_OPTIONS.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {LEAD_TIME_LABELS[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        <Field data-invalid={errors.notes ? true : undefined}>
          <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
          <Textarea id="notes"  {...register("notes")} />
          {errors.notes ? <FieldError>{errors.notes.message}</FieldError> : null}
        </Field>
      </FieldGroup>

      {via === "rules" ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <SparklesIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Add an AI key in Settings for smarter understanding of what you say.
        </p>
      ) : null}

      <FormError message={errors.root?.message} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="page" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="page" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
