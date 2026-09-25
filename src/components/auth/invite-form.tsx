"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { acceptInvite } from "@/app/(auth)/invite/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type Values = z.infer<typeof schema>;

export function InviteForm({ token, email }: { token: string; email: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  });

  async function onSubmit({ name, password }: Values) {
    setFormError(null);
    // On success the action redirects to the dashboard.
    const result = await acceptInvite(token, { name, password });
    if (result && !result.ok) setFormError(result.error);
  }

  const fields = [
    { name: "name", label: "Name", type: "text", autoComplete: "name" },
    {
      name: "password",
      label: "Password",
      type: "password",
      autoComplete: "new-password",
      hint: "At least 10 characters.",
    },
    {
      name: "confirmPassword",
      label: "Confirm password",
      type: "password",
      autoComplete: "new-password",
    },
  ] as const;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} readOnly disabled />
        </Field>
        {fields.map((f) => (
          <Controller
            key={f.name}
            name={f.name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={f.name}>{f.label}</FieldLabel>
                <Input
                  {...field}
                  id={f.name}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  aria-invalid={fieldState.invalid}
                />
                {"hint" in f && !fieldState.invalid && (
                  <FieldDescription>{f.hint}</FieldDescription>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ))}
        {formError && <FieldError>{formError}</FieldError>}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </FieldGroup>
    </form>
  );
}
