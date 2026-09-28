"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Controller,
  useForm,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";

import { changePassword, setPassword } from "@/app/(site)/account/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import {
  newPasswordSchema,
  passwordSchema,
  type NewPasswordInput,
  type PasswordInput,
} from "@/lib/validation/profile";

type FieldSpec<T> = { name: Path<T>; label: string; autoComplete: string };

function PasswordForm<T extends FieldValues>({
  form,
  fields,
  title,
  description,
  submitLabel,
  onSubmit,
}: {
  form: UseFormReturn<T>;
  fields: FieldSpec<T>[];
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (values: T) => Promise<void>;
}) {
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
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
                      type="password"
                      autoComplete={f.autoComplete}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ))}
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="animate-spin" />
            )}
            {submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

/** Show a failed result on the form; returns whether it succeeded. */
function applyResult<T extends FieldValues>(
  form: UseFormReturn<T>,
  result: ActionResult,
) {
  if (result.ok) return true;
  toast.error(result.error);
  for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
    form.setError(field as Path<T>, { message });
  }
  return false;
}

function ChangePassword() {
  const form = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  return (
    <PasswordForm
      form={form}
      title="Password"
      description="Changing it signs you out on every other device."
      submitLabel="Change password"
      fields={[
        {
          name: "currentPassword",
          label: "Current password",
          autoComplete: "current-password",
        },
        {
          name: "newPassword",
          label: "New password",
          autoComplete: "new-password",
        },
        {
          name: "confirmPassword",
          label: "Confirm new password",
          autoComplete: "new-password",
        },
      ]}
      onSubmit={async (values) => {
        if (!applyResult(form, await changePassword(values))) return;
        form.reset();
        toast.success("Password changed. Other devices were signed out.");
      }}
    />
  );
}

function SetPassword({ providers }: { providers: string[] }) {
  const router = useRouter();
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const via = providers.includes("github") ? "GitHub" : "another service";
  return (
    <PasswordForm
      form={form}
      title="Password"
      description={`You sign in with ${via}. Add a password to also sign in with your email.`}
      submitLabel="Set password"
      fields={[
        {
          name: "newPassword",
          label: "New password",
          autoComplete: "new-password",
        },
        {
          name: "confirmPassword",
          label: "Confirm new password",
          autoComplete: "new-password",
        },
      ]}
      onSubmit={async (values) => {
        if (!applyResult(form, await setPassword(values))) return;
        toast.success("Password set. You can now sign in with your email.");
        router.refresh();
      }}
    />
  );
}

export function PasswordCard({
  hasPassword,
  providers,
}: {
  hasPassword: boolean;
  providers: string[];
}) {
  return hasPassword ? (
    <ChangePassword />
  ) : (
    <SetPassword providers={providers} />
  );
}
