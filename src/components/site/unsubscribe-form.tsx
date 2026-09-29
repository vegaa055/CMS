"use client";

import { CircleCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { unsubscribe } from "@/app/(site)/unsubscribe/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Unsubscribing takes a click: mail scanners open links, but don't click. */
export function UnsubscribeForm({
  token,
  label,
}: {
  token: string;
  label: string;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <Alert>
        <CircleCheck />
        <AlertTitle>You&apos;re unsubscribed</AlertTitle>
        <AlertDescription>
          <p>
            We won&apos;t email you about {label} anymore. Changed your mind?
            Turn it back on in{" "}
            <Link href="/account" className="underline underline-offset-4">
              your account
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        className="self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await unsubscribe(token);
            if (result.ok) setDone(true);
            else setError(result.error);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />}
        Unsubscribe
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
