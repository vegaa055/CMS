"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sendVerificationEmail } from "@/lib/auth/client";
import { verifyEmailUrl } from "@/lib/auth/landing";

const schema = z.object({ email: z.email("Enter a valid email") });
type Values = z.infer<typeof schema>;

/**
 * Sends a fresh verification link. Signed-in users get it at their own
 * address; otherwise they type the address (the response never says whether
 * an account exists).
 */
export function ResendVerification({
  email,
  next,
}: {
  /** The signed-in user's address, if any. */
  email?: string;
  next?: string;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: email ?? "" },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    const { error } = await sendVerificationEmail({
      email: values.email,
      callbackURL: verifyEmailUrl(next),
    });
    if (error) {
      setFormError(
        error.status === 429
          ? "Too many requests. Try again in a minute."
          : error.code === "EMAIL_ALREADY_VERIFIED"
            ? "Your email is already verified. Reload this page."
            : (error.message ?? "Couldn't send the link. Try again."),
      );
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <Alert>
        <MailCheck />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          If {sentTo} still needs confirming, a new link is on its way. It works
          for 24 hours.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {!email && (
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
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        )}
        {formError && <FieldError>{formError}</FieldError>}
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Send a new link
        </Button>
      </FieldGroup>
    </form>
  );
}
