"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { updateName } from "@/app/(site)/account/actions";
import { UserAvatar } from "@/components/admin/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  accountNameSchema,
  type AccountNameInput,
} from "@/lib/validation/profile";

export function NameCard({
  initialName,
  image,
  staff,
}: {
  initialName: string;
  image: string | null;
  /** Team members also have an author profile in the dashboard. */
  staff: boolean;
}) {
  const form = useForm<AccountNameInput>({
    resolver: zodResolver(accountNameSchema),
    defaultValues: { name: initialName },
  });
  const name = useWatch({ control: form.control, name: "name" });
  const { errors, isDirty, isSubmitting } = form.formState;

  async function onSubmit(values: AccountNameInput) {
    const result = await updateName(values);
    if (!result.ok) {
      toast.error(result.error);
      if (result.fieldErrors?.name) {
        form.setError("name", { message: result.fieldErrors.name });
      }
      return;
    }
    form.reset(values);
    toast.success("Name saved");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How you appear on {staff ? "your posts and " : ""}the site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <UserAvatar
              name={name || initialName}
              image={image}
              className="size-14 text-lg"
            />
            <Field className="flex-1" data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="account-name">Display name</FieldLabel>
              <Input
                id="account-name"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              {!errors.name && (
                <FieldDescription>
                  {staff ? (
                    <>
                      Change your photo, username, and bio in your{" "}
                      <Link href="/admin/profile">author profile</Link>.
                    </>
                  ) : image ? (
                    "Your photo comes from GitHub."
                  ) : (
                    "Your initials stand in for a photo."
                  )}
                </FieldDescription>
              )}
              <FieldError errors={[errors.name]} />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
