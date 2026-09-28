"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteUser } from "@/lib/auth/client";

export function DeleteAccountCard({
  hasPassword,
  staff,
}: {
  hasPassword: boolean;
  staff: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword("");
      setError(null);
    }
  }

  function confirm() {
    startTransition(async () => {
      setError(null);
      const { error } = await deleteUser(hasPassword ? { password } : {});
      if (error) {
        setError(
          error.code === "INVALID_PASSWORD"
            ? "That password is incorrect."
            : error.code === "SESSION_EXPIRED"
              ? "For your security, sign out and sign back in, then try again."
              : error.status === 429
                ? "Too many attempts. Try again in a minute."
                : (error.message ?? "Couldn't delete your account."),
        );
        return;
      }
      toast.success("Your account was deleted");
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently deletes your account and signs you out everywhere.
          {staff && " Your posts stay published without an author."}
        </CardDescription>
        <CardAction>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </CardAction>
      </CardHeader>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This can&apos;t be undone.
              {hasPassword && " Enter your password to confirm."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {hasPassword && (
            <Field>
              <FieldLabel htmlFor="delete-password">Password</FieldLabel>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          {error && <FieldError>{error}</FieldError>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={confirm}
              disabled={pending || (hasPassword && !password)}
            >
              {pending && <Loader2 className="animate-spin" />}
              Delete my account
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
