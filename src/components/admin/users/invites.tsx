"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, MailPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  changeUserRole,
  createInvite,
  revokeInvite,
  type InviteResult,
} from "@/app/admin/users/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import type { PendingInvite } from "@/lib/queries/admin";

const schema = z.object({
  email: z.email("Enter a valid email"),
  role: z.enum(STAFF_ROLES),
  sendEmail: z.boolean(),
});
type Values = z.infer<typeof schema>;

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={url}
        className="font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Invite link copied");
        }}
      >
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/** Shown instead of an invite link when the email belongs to a reader. */
function PromoteReader({
  reader,
  email,
  onDone,
}: {
  reader: Extract<InviteResult, { kind: "existing-reader" }>;
  email: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const role = ROLE_LABELS[reader.role].toLowerCase();

  function promote() {
    startTransition(async () => {
      const result = await changeUserRole(reader.userId, reader.role);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${reader.name} is now ${role}`);
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{reader.name} already has an account</DialogTitle>
        <DialogDescription>
          {email} signed up as a reader. Make them{" "}
          {/^[aeiou]/.test(role) ? "an" : "a"} {role} instead? They keep their
          account and get dashboard access right away.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={promote} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Make {role}
        </Button>
      </DialogFooter>
    </>
  );
}

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<InviteResult | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "author", sendEmail: true },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setOutcome(null);
      form.reset();
    }
  }

  async function onSubmit(values: Values) {
    const result = await createInvite(values);
    if (!result.ok) {
      if (result.fieldErrors?.email)
        form.setError("email", { message: result.fieldErrors.email });
      toast.error(result.error);
      return;
    }
    setOutcome(result.data);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MailPlus /> Invite user
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {outcome?.kind === "invite" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {outcome.emailed ? "Invite sent" : "Invite created"}
                </DialogTitle>
                <DialogDescription>
                  {outcome.emailed
                    ? `We emailed the link to ${form.getValues("email")}. You can also copy it below.`
                    : outcome.emailed === false
                      ? `We couldn't send the email. Copy the link and send it to ${form.getValues("email")} yourself.`
                      : `Send this link to ${form.getValues("email")}.`}{" "}
                  It works once and expires {formatDateTime(outcome.expiresAt)},
                  and won&apos;t be shown again.
                </DialogDescription>
              </DialogHeader>
              <CopyLink url={outcome.url} />
              <DialogFooter>
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : outcome?.kind === "existing-reader" ? (
            <PromoteReader
              reader={outcome}
              email={form.getValues("email")}
              onDone={() => onOpenChange(false)}
            />
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <DialogHeader>
                <DialogTitle>Invite a team member</DialogTitle>
                <DialogDescription>
                  They get a one-time sign-up link that expires in a week.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup className="py-4">
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                      <Input
                        {...field}
                        id="invite-email"
                        type="email"
                        autoFocus
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  name="role"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="invite-role">Role</FieldLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="invite-role" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAFF_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldDescription>
                        Authors write drafts; editors publish and manage tags;
                        admins also manage users and settings.
                      </FieldDescription>
                    </Field>
                  )}
                />
                <Controller
                  name="sendEmail"
                  control={form.control}
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="invite-send-email">
                          Email the link to them
                        </FieldLabel>
                        <FieldDescription>
                          Either way, you can copy it next.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="invite-send-email"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
              </FieldGroup>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="animate-spin" />
                  )}
                  Create invite
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RevokeButton({ invite }: { invite: PendingInvite }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeInvite(invite.id);
          if (result.ok) toast.success(`Invite for ${invite.email} revoked`);
          else toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Revoke
    </Button>
  );
}

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  if (!invites.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invites</CardTitle>
        <CardDescription>
          Links are shown only once. To resend, invite the same email again for
          a fresh link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="-mx-2 divide-y">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-3 px-2 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 truncate font-medium">
                  {invite.email}
                  <Badge variant="secondary">{ROLE_LABELS[invite.role]}</Badge>
                  {invite.expired && (
                    <Badge variant="destructive">Expired</Badge>
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {invite.invitedBy ? `Invited by ${invite.invitedBy} · ` : ""}
                  {invite.expired ? "Expired" : "Expires"}{" "}
                  {formatDateTime(invite.expiresAt)}
                </span>
              </div>
              <RevokeButton invite={invite} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
