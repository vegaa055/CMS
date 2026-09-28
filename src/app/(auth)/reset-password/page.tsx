import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

/**
 * The link in a reset email goes through Better Auth, which checks the token
 * and lands here with `?token=` (or `?error=INVALID_TOKEN`).
 */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token, error } = await searchParams;
  const usable = typeof token === "string" && token && !error;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">
          Choose a new password
        </h1>
        {usable && (
          <p className="text-muted-foreground text-sm">
            You&apos;ll use it to sign in from now on.
          </p>
        )}
      </div>
      {usable ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert>
          <LinkIcon />
          <AlertTitle>This link isn&apos;t valid</AlertTitle>
          <AlertDescription>
            Reset links work once and expire after an hour.{" "}
            <Link
              href="/forgot-password"
              className="underline underline-offset-4"
            >
              Request a new one
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
