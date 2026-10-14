import type { ComponentProps } from "react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Label, input and error message, wired together for screen readers. */
export function FormField({
  id,
  label,
  error,
  ...inputProps
}: { id: string; label: string; error?: string } & ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="h-11 text-base md:h-9 md:text-sm"
        {...inputProps}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}
