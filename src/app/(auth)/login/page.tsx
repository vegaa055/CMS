import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { githubEnabled, isRegistrationOpen } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeRedirectPath((await searchParams).next);
  if (await getSession()) redirect(next);

  const registrationOpen = await isRegistrationOpen();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to manage your content.
        </p>
      </div>
      <LoginForm next={next} githubEnabled={githubEnabled} />
      {registrationOpen && (
        <p className="text-muted-foreground text-center text-sm">
          No account?{" "}
          <Link
            href="/register"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
