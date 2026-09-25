"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { updateProfile } from "@/app/admin/profile/actions";
import { MediaPickerDialog } from "@/components/admin/media/media-picker-dialog";
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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authorPath } from "@/lib/posts/urls";
import { slugify } from "@/lib/slug";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

export function ProfileForm({
  initial,
  email,
}: {
  initial: ProfileInput;
  email: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: initial,
  });
  const [name, image, username] = useWatch({
    control: form.control,
    name: ["name", "image", "username"],
  });
  const { errors, isDirty, isSubmitting } = form.formState;
  const savedUsername = initial.username;

  async function onSubmit(values: ProfileInput) {
    const result = await updateProfile(values);
    if (!result.ok) {
      toast.error(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof ProfileInput, { message });
      }
      return;
    }
    form.reset({ ...values, username: values.username.toLowerCase() });
    toast.success("Profile saved");
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How you appear on posts and your public author page. Signed in as{" "}
            {email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Avatar</FieldLabel>
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={name || "?"}
                  image={image}
                  className="size-16 text-lg"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPickerOpen(true)}
                  >
                    {image ? "Change" : "Choose image"}
                  </Button>
                  {image && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        form.setValue("image", "", { shouldDirty: true })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <MediaPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                title="Choose an avatar"
                onSelect={(item) =>
                  form.setValue("image", item.url, { shouldDirty: true })
                }
              />
            </Field>

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="name">Display name</FieldLabel>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Controller
              name="username"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    {...field}
                    id="username"
                    placeholder={slugify(name) || "your-name"}
                    className="font-mono text-sm"
                    aria-invalid={fieldState.invalid}
                    onChange={(e) =>
                      field.onChange(e.target.value.toLowerCase())
                    }
                  />
                  {fieldState.error ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : (
                    <FieldDescription className="flex flex-wrap items-center gap-2">
                      {username ? (
                        <span className="font-mono">
                          {authorPath(username)}
                        </span>
                      ) : (
                        "Set a username to get a public author page."
                      )}
                      {savedUsername && savedUsername === username && (
                        <Link
                          href={authorPath(savedUsername)}
                          target="_blank"
                          className="text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline"
                        >
                          View <ExternalLink className="size-3" />
                        </Link>
                      )}
                    </FieldDescription>
                  )}
                </Field>
              )}
            />

            <Field data-invalid={Boolean(errors.bio)}>
              <FieldLabel htmlFor="bio">Bio</FieldLabel>
              <Textarea
                id="bio"
                rows={4}
                placeholder="A sentence or two about you"
                aria-invalid={Boolean(errors.bio)}
                {...form.register("bio")}
              />
              <FieldError errors={[errors.bio]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || isSubmitting}
            onClick={() => form.reset()}
          >
            Discard
          </Button>
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save profile
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
