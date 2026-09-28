import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { githubEnabled, registrationMode } from "@/lib/auth";
import { landingPath, nextParam } from "@/lib/auth/landing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = nextParam((await searchParams).next);
  const session = await getSession();
  if (session) redirect(landingPath(session.user.role, next));

  const registrationOpen = (await registrationMode()) !== "closed";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to your account.
        </p>
      </div>
      <LoginForm next={next} githubEnabled={githubEnabled} />
      {registrationOpen && (
        <p className="text-muted-foreground text-center text-sm">
          No account?{" "}
          <Link
            href={
              next ? `/register?next=${encodeURIComponent(next)}` : "/register"
            }
            className="text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
