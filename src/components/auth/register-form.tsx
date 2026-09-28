"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { GitHubButton } from "@/components/auth/github-button";
import { useCaptcha } from "@/components/auth/turnstile";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth/client";
import { continueUrl, verifyEmailUrl } from "@/lib/auth/landing";

const schema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80),
    email: z.email("Enter a valid email"),
    password: z.string().min(10, "Use at least 10 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

const fields: {
  name: keyof Values;
  label: string;
  type: string;
  autoComplete: string;
  description?: string;
}[] = [
  { name: "name", label: "Name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    description: "At least 10 characters.",
  },
  {
    name: "confirmPassword",
    label: "Confirm password",
    type: "password",
    autoComplete: "new-password",
  },
];

export function RegisterForm({
  next,
  githubEnabled,
  captchaSiteKey,
}: {
  /** Page to return to after signing up (already validated). */
  next?: string;
  githubEnabled: boolean;
  /** Turnstile site key, when sign-up has a bot check. */
  captchaSiteKey?: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const captcha = useCaptcha(captchaSiteKey, "sign-up");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit({ name, email, password }: Values) {
    setFormError(null);
    const { error } = await signUp.email(
      {
        name,
        email,
        password,
        // Where the link in the confirmation email lands.
        callbackURL: verifyEmailUrl(next),
      },
      { headers: captcha.headers },
    );
    if (error) {
      captcha.reset();
      if (error.code === "PASSWORD_COMPROMISED") {
        form.setError("password", { message: "Found in a data breach" });
      }
      setFormError(error.message ?? "Could not create account");
      return;
    }
    toast.success("Account created. Check your inbox to confirm your email.");
    router.replace(continueUrl(next));
    router.refresh();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        {githubEnabled && (
          <>
            <GitHubButton callbackURL={continueUrl(next)} />
            <FieldSeparator>or</FieldSeparator>
          </>
        )}
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
                {f.description && !fieldState.invalid && (
                  <FieldDescription>{f.description}</FieldDescription>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ))}
        {captcha.widget}
        {formError && <FieldError>{formError}</FieldError>}
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting || !captcha.ready}
        >
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
        <FieldDescription className="text-center">
          We keep your name and email only to run your account, and never share
          them. You can delete your account at any time from your account page.
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
