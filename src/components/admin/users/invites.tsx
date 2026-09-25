"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Loader2, MailPlus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createInvite, revokeInvite } from "@/app/admin/users/actions";
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
import { ROLE_LABELS, ROLES } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import type { PendingInvite } from "@/lib/queries/admin";

const schema = z.object({
  email: z.email("Enter a valid email"),
  role: z.enum(ROLES),
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

export function InviteButton() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(
    null,
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "author" },
  });

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setLink(null);
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
    setLink(result.data);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <MailPlus /> Invite user
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {link ? (
            <>
              <DialogHeader>
                <DialogTitle>Invite created</DialogTitle>
                <DialogDescription>
                  Send this link to {form.getValues("email")}. It works once and
                  expires {formatDateTime(link.expiresAt)}. It won&apos;t be
                  shown again.
                </DialogDescription>
              </DialogHeader>
              <CopyLink url={link.url} />
              <DialogFooter>
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <DialogHeader>
                <DialogTitle>Invite a user</DialogTitle>
                <DialogDescription>
                  You&apos;ll get a one-time sign-up link to send them.
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
                          {ROLES.map((r) => (
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
