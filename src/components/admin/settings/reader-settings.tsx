"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateReaderSettings } from "@/app/admin/settings/actions";
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
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { ReaderSettings } from "@/lib/validation/settings";

/** Toggles save immediately; there's nothing else to fill in. */
export function ReaderSettingsCard({ initial }: { initial: ReaderSettings }) {
  const [signupEnabled, setSignupEnabled] = useState(initial.signupEnabled);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setSignupEnabled(next);
    startTransition(async () => {
      const result = await updateReaderSettings({ signupEnabled: next });
      if (!result.ok) {
        setSignupEnabled(!next);
        toast.error(result.error);
        return;
      }
      toast.success(next ? "Reader sign-up is on" : "Reader sign-up is off");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reader accounts</CardTitle>
        <CardDescription>
          Readers can sign in to the public site but never see the dashboard.
          Your team still joins by invitation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="reader-signup">
              Allow reader sign-up
            </FieldLabel>
            <FieldDescription>
              Anyone can create a reader account at /register.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="reader-signup"
            checked={signupEnabled}
            onCheckedChange={toggle}
            disabled={pending}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
