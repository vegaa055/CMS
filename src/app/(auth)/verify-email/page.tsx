import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ResendVerification } from "@/components/auth/resend-verification";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { continueUrl, nextParam } from "@/lib/auth/landing";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Confirm your email",
  robots: { index: false, follow: false },
};

/**
 * Where verification links land (via Better Auth, which adds `?error=` if
 * the link is bad). Signed-in users see their account's real state.
 */
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const params = await searchParams;
  const next = nextParam(params.next);
  const error = typeof params.error === "string" ? params.error : undefined;
  const session = await getSession();
  const verified = session ? session.user.emailVerified : !error;

  if (verified) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-4xl tracking-tight">
          Email confirmed
        </h1>
        <Alert>
          <CircleCheck />
          <AlertTitle>You&apos;re all set</AlertTitle>
          <AlertDescription>
            Thanks for confirming{" "}
            {session ? session.user.email : "your email address"}.
          </AlertDescription>
        </Alert>
        <Button size="lg" asChild>
          {session ? (
            <Link href={continueUrl(next)}>Continue</Link>
          ) : (
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            >
              Sign in
            </Link>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">
          {error === "TOKEN_EXPIRED"
            ? "This link has expired"
            : error
              ? "This link isn't valid"
              : "Confirm your email"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {error
            ? "Confirmation links work for 24 hours. Send yourself a new one."
            : `We sent a confirmation link to ${session!.user.email}. Can't find it? Check spam, or send another.`}
        </p>
      </div>
      <ResendVerification email={session?.user.email} next={next} />
    </div>
  );
}
