"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ResendVerification } from "@/components/auth/resend-verification";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changeEmail } from "@/lib/auth/client";
import { emailChangeUrl } from "@/lib/auth/landing";

const schema = z.object({ newEmail: z.email("Enter a valid email") });
type Values = z.infer<typeof schema>;

export function EmailCard({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const [requested, setRequested] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { newEmail: "" },
  });

  async function onSubmit({ newEmail }: Values) {
    if (newEmail.toLowerCase() === email) {
      form.setError("newEmail", { message: "That's your current email" });
      return;
    }
    const { error } = await changeEmail({
      newEmail,
      callbackURL: emailChangeUrl("sent"),
    });
    if (error) {
      toast.error(
        error.status === 429
          ? "Too many requests. Try again in a minute."
          : (error.message ?? "Couldn't start the change."),
      );
      return;
    }
    setRequested(newEmail);
    form.reset();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>
          You sign in with it, and account emails go to it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-all">{email}</span>
          {verified ? (
            <Badge variant="secondary">Confirmed</Badge>
          ) : (
            <Badge variant="outline">Not confirmed</Badge>
          )}
        </div>

        {!verified && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              Confirm your address to comment on posts. Can&apos;t find the
              email? Send another.
            </p>
            <ResendVerification email={email} compact />
          </div>
        )}

        {requested ? (
          <Alert>
            <MailCheck />
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>
              {verified
                ? `We sent a link to ${email} to confirm the change. After that, we'll send one more to ${requested}.`
                : `We sent a link to ${requested}. Open it to finish the change.`}{" "}
              If {requested} already has an account, no email is sent.
            </AlertDescription>
          </Alert>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <Controller
              name="newEmail"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="flex-1" data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="new-email">New email</FieldLabel>
                  <Input
                    {...field}
                    id="new-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Button
              type="submit"
              variant="outline"
              className="sm:mt-[1.625rem]"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="animate-spin" />
              )}
              Change email
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
