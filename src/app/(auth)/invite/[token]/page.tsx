import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { InviteForm } from "@/components/auth/invite-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { findValidInvite } from "@/lib/invites";
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

  if (session) {
    return (
      <Alert>
        <LinkIcon />
        <AlertTitle>You&apos;re already signed in</AlertTitle>
        <AlertDescription>
          You&apos;re signed in as {session.user.email}. Sign out first to
          accept an invitation for {invite.email}.{" "}
          <Link href="/admin" className="underline underline-offset-4">
            Go to dashboard
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl tracking-tight">
          Join {site.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ve been invited with the{" "}
          <strong className="text-foreground">
            {ROLE_LABELS[invite.role]}
          </strong>{" "}
          role. Choose a name and password to finish.
        </p>
      </div>
      <InviteForm token={token} email={invite.email} />
    </div>
  );
}
