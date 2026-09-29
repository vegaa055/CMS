"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateCommentSettings } from "@/app/admin/settings/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CommentModeration } from "@/lib/comments";
import type { CommentSettings } from "@/lib/validation/settings";

const MODERATION: Record<
  CommentModeration,
  { label: string; description: string }
> = {
  first: {
    label: "A reader's first comment",
    description:
      "Once you approve someone's first comment, their later ones appear right away.",
  },
  all: {
    label: "Every reader comment",
    description: "Nothing from readers appears until a moderator approves it.",
  },
  none: {
    label: "Nothing",
    description:
      "Readers' comments appear right away. You can still remove them.",
  },
};

/** Changes save immediately, like the reader settings. */
export function CommentSettingsCard({ initial }: { initial: CommentSettings }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();

  function save(next: CommentSettings, message: string) {
    const previous = values;
    setValues(next);
    startTransition(async () => {
      const result = await updateCommentSettings(next);
      if (!result.ok) {
        setValues(previous);
        toast.error(result.error);
        return;
      }
      toast.success(message);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
        <CardDescription>
          Signed-in readers with a confirmed email can comment on posts, and
          your team&apos;s comments always appear right away. Editors and admins
          moderate them under Comments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="comments-enabled">Allow comments</FieldLabel>
              <FieldDescription>
                When off, existing comments stay visible but no one can add
                more. Each post can also turn them off in the editor.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="comments-enabled"
              checked={values.enabled}
              onCheckedChange={(enabled) =>
                save(
                  { ...values, enabled },
                  enabled ? "Comments are on" : "Comments are off",
                )
              }
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="comments-moderation">
              Hold for approval
            </FieldLabel>
            <Select
              value={values.moderation}
              onValueChange={(moderation) =>
                save(
                  { ...values, moderation: moderation as CommentModeration },
                  "Moderation updated",
                )
              }
              disabled={pending}
            >
              <SelectTrigger
                id="comments-moderation"
                className="w-full sm:w-72"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODERATION).map(([value, option]) => (
                  <SelectItem key={value} value={value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              {MODERATION[values.moderation].description}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
