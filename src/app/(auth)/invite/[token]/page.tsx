import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInviteButton, InviteForm } from "@/components/auth/invite-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { landingPath } from "@/lib/auth/landing";
import { isStaff, ROLE_LABELS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { accountExists, findValidInvite } from "@/lib/invites";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Accept invitation",
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [invite, session, site] = await Promise.all([
    findValidInvite(token),
    getSession(),
    getSiteSettings(),
  ]);

  if (!invite) {
    return (
      <Alert>
        <LinkIcon />
        <AlertTitle>This invitation isn&apos;t valid</AlertTitle>
        <AlertDescription>
          It may have expired, been revoked, or already been used. Ask an admin
          for a new link.
        </AlertDescription>
      </Alert>
    );
  }

  const heading = (description: React.ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-display text-4xl tracking-tight">Join {site.name}</h1>
      <p className="text-muted-foreground text-sm">
        You&apos;ve been invited with the{" "}
        <strong className="text-foreground">{ROLE_LABELS[invite.role]}</strong>{" "}
        role. {description}
      </p>
    </div>
  );

  if (session) {
    const invitedHere = session.user.email.toLowerCase() === invite.email;
    // A reader who was invited: upgrade the existing account.
    if (invitedHere && session.user.role === "reader") {
      return (
        <div className="flex flex-col gap-6">
          {heading("Accepting adds dashboard access to your account.")}
          <AcceptInviteButton token={token} />
        </div>
      );
    }
    return (
      <Alert>
        <LinkIcon />
        <AlertTitle>You&apos;re already signed in</AlertTitle>
        <AlertDescription>
          {invitedHere
            ? "Your account already has dashboard access."
            : `You're signed in as ${session.user.email}. Sign out first to accept an invitation for ${invite.email}.`}{" "}
          <Link
            href={landingPath(session.user.role)}
            className="underline underline-offset-4"
          >
            {isStaff(session.user.role)
              ? "Go to dashboard"
              : "Back to the site"}
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  // They already have an account (e.g. signed up as a reader after being
  // invited): sign in first, then accept above.
  if (await accountExists(invite.email)) {
    return (
      <div className="flex flex-col gap-6">
        {heading(
          `You already have an account with ${invite.email}, so sign in to accept.`,
        )}
        <Button size="lg" asChild>
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
            Sign in to accept
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {heading("Choose a name and password to finish.")}
      <InviteForm token={token} email={invite.email} />
    </div>
  );
}
