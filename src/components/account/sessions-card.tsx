"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { revokeOtherSessions } from "@/lib/auth/client";

export function SessionsCard({ otherSessions }: { otherSessions: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOutElsewhere() {
    startTransition(async () => {
      const { error } = await revokeOtherSessions();
      if (error) {
        toast.error(error.message ?? "Couldn't sign out your other devices.");
        return;
      }
      toast.success("Signed out everywhere else");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signed-in devices</CardTitle>
        <CardDescription>
          {otherSessions === 0
            ? "You're only signed in here."
            : `You're also signed in on ${otherSessions} other ${otherSessions === 1 ? "device" : "devices"}.`}
        </CardDescription>
        {otherSessions > 0 && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={signOutElsewhere}
            >
              {pending && <Loader2 className="animate-spin" />}
              Sign out other devices
            </Button>
          </CardAction>
        )}
      </CardHeader>
    </Card>
  );
}
