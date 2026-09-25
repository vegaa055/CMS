"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { createTag, updateTag } from "@/app/admin/tags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/slug";
import { tagSchema, type TagInput } from "@/lib/validation/post";

export function TagFormDialog({
  tag,
  open,
  onOpenChange,
}: {
  /** Omit to create a new tag. */
  tag?: { id: string; name: string; slug: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<TagInput>({
    resolver: zodResolver(tagSchema),
    values: { name: tag?.name ?? "", slug: tag?.slug ?? "" },
  });

  async function onSubmit(values: TagInput) {
    setFormError(null);
    const result = tag
      ? await updateTag(tag.id, values)
      : await createTag(values);
    if (!result.ok) {
      setFormError(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (field === "name" || field === "slug")
          form.setError(field, { message });
      }
      return;
    }
    toast.success(tag ? "Tag updated" : "Tag created");
    onOpenChange(false);
    form.reset();
  }

  const name = useWatch({ control: form.control, name: "name" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{tag ? "Edit tag" : "New tag"}</DialogTitle>
            <DialogDescription>
              {tag
                ? "Renaming a tag updates it on every post that uses it."
                : "Tags group related posts together."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="py-4">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tag-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="tag-name"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="slug"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="tag-slug">Slug</FieldLabel>
                  <Input
                    {...field}
                    id="tag-slug"
                    placeholder={slugify(name) || "tag-slug"}
                    className="font-mono text-xs"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription>
                      Leave blank to generate from the name.
                    </FieldDescription>
                  )}
                </Field>
              )}
            />
            {formError && <FieldError>{formError}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              {tag ? "Save" : "Create tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
