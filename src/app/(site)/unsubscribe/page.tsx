import type { Metadata } from "next";
import Link from "next/link";

import { UnsubscribeForm } from "@/components/site/unsubscribe-form";
import { NOTIFICATION_LABELS, readToken } from "@/lib/notifications";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/** Where the unsubscribe link in every notification email leads. */
export default async function UnsubscribePage({
  searchParams,
}: PageProps<"/unsubscribe">) {
  const { token } = await searchParams;
  const target =
    typeof token === "string" && token.length < 500 ? readToken(token) : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pb-16">
      <h1 className="font-display text-4xl tracking-tight">Unsubscribe</h1>
      {target ? (
        <>
          <p className="text-muted-foreground">
            Stop emails about {NOTIFICATION_LABELS[target.kind]}? You can change
            any of your email settings in your account.
          </p>
          <UnsubscribeForm
            token={token as string}
            label={NOTIFICATION_LABELS[target.kind]}
          />
        </>
      ) : (
        <p className="text-muted-foreground">
          This unsubscribe link isn&apos;t valid; it may have been cut off. Sign
          in and change your email settings in{" "}
          <Link
            href="/account"
            className="text-foreground underline underline-offset-4"
          >
            your account
          </Link>{" "}
          instead.
        </p>
      )}
    </div>
  );
}
