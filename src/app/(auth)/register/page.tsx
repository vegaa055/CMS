import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { githubEnabled, isRegistrationOpen } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/admin");

  const registrationOpen = await isRegistrationOpen();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">
          Create an account
        </h1>
        <p className="text-muted-foreground text-sm">
          The first account created becomes the site admin.
        </p>
      </div>

      {registrationOpen ? (
        <RegisterForm githubEnabled={githubEnabled} />
      ) : (
        <Alert>
          <LockKeyhole />
          <AlertTitle>Registration is closed</AlertTitle>
          <AlertDescription>
            New accounts are invite-only. Ask a site admin for access.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
