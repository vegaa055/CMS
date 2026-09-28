import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { githubEnabled, registrationMode } from "@/lib/auth";
import { landingPath, nextParam } from "@/lib/auth/landing";
import { getSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  const next = nextParam((await searchParams).next);
  const session = await getSession();
  if (session) redirect(landingPath(session.user.role, next));

  const [mode, site] = await Promise.all([
    registrationMode(),
    getSiteSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">
          {mode === "first-admin" ? "Set up your site" : "Create an account"}
        </h1>
        {mode !== "closed" && (
          <p className="text-muted-foreground text-sm">
            {mode === "first-admin"
              ? "This is the first account, so it becomes the site admin."
              : `Join ${site.name} as a reader.`}
          </p>
        )}
      </div>

      {mode === "closed" ? (
        <Alert>
          <LockKeyhole />
          <AlertTitle>Registration is closed</AlertTitle>
          <AlertDescription>
            New accounts can&apos;t be created right now. Team members join by
            invitation.
          </AlertDescription>
        </Alert>
      ) : (
        <RegisterForm next={next} githubEnabled={githubEnabled} />
      )}

      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
