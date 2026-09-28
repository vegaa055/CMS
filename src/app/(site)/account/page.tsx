import {
  CircleCheck,
  LayoutDashboard,
  LinkIcon,
  MailCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { EmailCard } from "@/components/account/email-card";
import { NameCard } from "@/components/account/name-card";
import { PasswordCard } from "@/components/account/password-card";
import { SessionsCard } from "@/components/account/sessions-card";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isStaff, ROLE_LABELS } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { countOtherSessions, getSignInMethods } from "@/lib/queries/account";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

/** Where email-change links land (see `emailChangeUrl`). */
function EmailChangeNotice({
  step,
  error,
  email,
}: {
  step: string | undefined;
  error: string | undefined;
  email: string;
}) {
  if (step !== "sent" && step !== "done") return null;
  if (error) {
    return (
      <Alert>
        <LinkIcon />
        <AlertTitle>That link didn&apos;t work</AlertTitle>
        <AlertDescription>
          Email-change links expire after 24 hours and work once. Start the
          change again below.
        </AlertDescription>
      </Alert>
    );
  }
  return step === "done" ? (
    <Alert>
      <CircleCheck />
      <AlertTitle>Email changed</AlertTitle>
      <AlertDescription>
        You&apos;ll sign in with {email} from now on.
      </AlertDescription>
    </Alert>
  ) : (
    <Alert>
      <MailCheck />
      <AlertTitle>One more step</AlertTitle>
      <AlertDescription>
        We&apos;ve sent a link to your new address. Open it to finish changing
        your email.
      </AlertDescription>
    </Alert>
  );
}

export default async function AccountPage({
  searchParams,
}: PageProps<"/account">) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent("/account")}`);
  const { user, session: current } = session;
  const params = await searchParams;
  const [methods, otherSessions] = await Promise.all([
    getSignInMethods(user.id),
    countOtherSessions(user.id, current.id),
  ]);
  const staff = isStaff(user.role);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <header className="flex items-center gap-4">
        <UserAvatar
          name={user.name}
          image={user.image}
          className="size-16 text-xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="font-display text-4xl tracking-tight">Your account</h1>
          <p className="text-muted-foreground truncate text-sm">
            {user.name} · {staff ? ROLE_LABELS[user.role] : "Reader"}
          </p>
        </div>
        {staff && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin">
              <LayoutDashboard /> Dashboard
            </Link>
          </Button>
        )}
      </header>

      <EmailChangeNotice
        step={
          typeof params.emailChange === "string"
            ? params.emailChange
            : undefined
        }
        error={typeof params.error === "string" ? params.error : undefined}
        email={user.email}
      />

      <NameCard
        initialName={user.name}
        image={user.image ?? null}
        staff={staff}
      />
      <EmailCard email={user.email} verified={user.emailVerified} />
      <PasswordCard
        hasPassword={methods.hasPassword}
        providers={methods.providers}
      />
      <SessionsCard otherSessions={otherSessions} />
      <DeleteAccountCard hasPassword={methods.hasPassword} staff={staff} />
    </div>
  );
}
