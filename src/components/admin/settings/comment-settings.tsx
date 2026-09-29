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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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

const LINK_LIMITS = [
  { value: 0, label: "Never" },
  { value: 1, label: "With any link" },
  { value: 2, label: "With 2 or more links" },
  { value: 3, label: "With 3 or more links" },
  { value: 5, label: "With 5 or more links" },
];

/** One word or phrase per line (commas work too). */
function parseWords(text: string) {
  return text
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter(Boolean);
}

/**
 * Switches and menus save immediately, like the reader settings; the
 * blocked words have their own Save button.
 */
export function CommentSettingsCard({ initial }: { initial: CommentSettings }) {
  const [values, setValues] = useState(initial);
  const [words, setWords] = useState(initial.blockedWords.join("\n"));
  const [pending, startTransition] = useTransition();
  const wordsChanged =
    parseWords(words).join("\n") !== values.blockedWords.join("\n");

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
          <Field>
            <FieldLabel htmlFor="comments-links">
              Hold comments with links
            </FieldLabel>
            <Select
              value={String(values.linkLimit)}
              onValueChange={(limit) =>
                save(
                  { ...values, linkLimit: Number(limit) },
                  "Link rule updated",
                )
              }
              disabled={pending}
            >
              <SelectTrigger id="comments-links" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_LIMITS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Spam usually comes with links, so readers&apos; comments with this
              many wait for review, even from people you&apos;ve approved
              before.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="comments-blocked">Blocked words</FieldLabel>
            <Textarea
              id="comments-blocked"
              rows={4}
              value={words}
              onChange={(e) => setWords(e.target.value)}
              placeholder={"One per line, e.g.\ncasino\ncheap pills"}
              className="font-mono text-sm"
            />
            <FieldDescription>
              Readers&apos; comments containing any of these wait for review.
              Case doesn&apos;t matter, and whole words only: &ldquo;ass&rdquo;
              won&apos;t catch &ldquo;class&rdquo;.
            </FieldDescription>
            <Button
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={pending || !wordsChanged}
              onClick={() => {
                const blockedWords = parseWords(words);
                setWords(blockedWords.join("\n"));
                save({ ...values, blockedWords }, "Blocked words saved");
              }}
            >
              Save words
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
