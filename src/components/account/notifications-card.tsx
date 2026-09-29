"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateNotification } from "@/app/(site)/account/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { NotificationKind } from "@/lib/notifications/kinds";

const OPTIONS: Record<
  NotificationKind,
  { label: string; description: string }
> = {
  replies: {
    label: "Replies to my comments",
    description: "When someone answers one of your comments.",
  },
  "post-comments": {
    label: "Comments on my posts",
    description: "When a comment is published on a post you wrote.",
  },
  digest: {
    label: "Daily moderation summary",
    description: "Once a day, when comments are waiting for review.",
  },
};

/** Switches save immediately. */
export function NotificationsCard({
  kinds,
  initial,
  verified,
}: {
  /** The kinds that apply to this person (by role). */
  kinds: NotificationKind[];
  initial: Record<NotificationKind, boolean>;
  verified: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(kind: NotificationKind, enabled: boolean) {
    setValues((v) => ({ ...v, [kind]: enabled }));
    startTransition(async () => {
      const result = await updateNotification({ kind, enabled });
      if (!result.ok) {
        setValues((v) => ({ ...v, [kind]: !enabled }));
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? "Emails turned on" : "Emails turned off");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email notifications</CardTitle>
        <CardDescription>
          {verified
            ? "Every email also has a one-click unsubscribe link."
            : "Confirm your email address to get these."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {kinds.map((kind) => (
            <Field key={kind} orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor={`notify-${kind}`}>
                  {OPTIONS[kind].label}
                </FieldLabel>
                <FieldDescription>{OPTIONS[kind].description}</FieldDescription>
              </FieldContent>
              <Switch
                id={`notify-${kind}`}
                checked={values[kind]}
                onCheckedChange={(enabled) => toggle(kind, enabled)}
                disabled={pending}
              />
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
