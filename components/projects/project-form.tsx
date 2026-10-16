"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { FormField } from "@/components/auth/form-field";
import { ModalBody, ModalFooter, modalFormClass } from "@/components/common/responsive-modal";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { projectSchema, type ProjectValues } from "@/lib/validation/projects";

/** Name and description. Used to create and to rename a project. */
export function ProjectForm({
  defaultValues = { name: "", description: "" },
  submitLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues?: ProjectValues;
  submitLabel: string;
  onSubmit: (values: ProjectValues) => Promise<{ ok: true } | { ok: false; error: string; field?: string }>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectValues>({ resolver: zodResolver(projectSchema), defaultValues });

  async function submit(values: ProjectValues) {
    const result = await onSubmit(values);
    if (!result.ok) setError(result.field === "name" ? "name" : "root", { message: result.error });
  }

  return (
    // Inside a ResponsiveModal: the fields scroll, the buttons stay in the fixed footer.
    <form onSubmit={handleSubmit(submit)} noValidate className={modalFormClass}>
      <ModalBody>
      <FieldGroup>
        <FormField id="name" label="Name" placeholder="For example: Kitchen renovation" autoFocus error={errors.name?.message} {...register("name")} />
        <Field data-invalid={errors.description ? true : undefined}>
          <FieldLabel htmlFor="description">Description (optional)</FieldLabel>
          <Textarea id="description" placeholder="What is this project about?" {...register("description")} />
          {errors.description ? <FieldError>{errors.description.message}</FieldError> : null}
        </Field>
      </FieldGroup>
      <FormError message={errors.root?.message} />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="ghost" size="page" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="page" disabled={isSubmitting}>
          {isSubmitting ? <Spinner /> : null}
          {submitLabel}
        </Button>
      </ModalFooter>
    </form>
  );
}
