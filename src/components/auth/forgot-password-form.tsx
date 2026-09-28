"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useCaptcha } from "@/components/auth/turnstile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/client";

const schema = z.object({ email: z.email("Enter a valid email") });
type Values = z.infer<typeof schema>;

export function ForgotPasswordForm({
  captchaSiteKey,
}: {
  /** Turnstile site key, when password reset has a bot check. */
  captchaSiteKey?: string;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const captcha = useCaptcha(captchaSiteKey, "password-reset");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: Values) {
    setFormError(null);
    const { error } = await requestPasswordReset(
      { email, redirectTo: "/reset-password" },
      { headers: captcha.headers },
    );
    if (error) {
      captcha.reset();
      setFormError(
        error.status === 429
          ? "Too many requests. Try again in a minute."
          : (error.message ?? "Something went wrong. Try again."),
      );
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    // Same answer whether or not the account exists.
    return (
      <Alert>
        <MailCheck />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          If there&apos;s an account for {sentTo}, we&apos;ve sent it a link to
          choose a new password. The link expires in an hour.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        {captcha.widget}
        {formError && <FieldError>{formError}</FieldError>}
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting || !captcha.ready}
        >
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Send reset link
        </Button>
      </FieldGroup>
    </form>
  );
}
