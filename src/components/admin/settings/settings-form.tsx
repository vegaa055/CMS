"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { updateSiteSettings } from "@/app/admin/settings/actions";
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
import {
  SOCIAL_LINKS,
  siteSettingsSchema,
  type SiteSettings,
} from "@/lib/validation/settings";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const form = useForm<SiteSettings>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: initial,
  });
  const { errors, isDirty, isSubmitting } = form.formState;

  async function onSubmit(values: SiteSettings) {
    const result = await updateSiteSettings(values);
    if (!result.ok) {
      toast.error(result.error);
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(field as keyof SiteSettings, { message });
      }
      return;
    }
    form.reset(values);
    toast.success("Settings saved");
  }

  const text = (
    name: "name" | "tagline" | "ownerName",
    label: string,
    description?: string,
  ) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        aria-invalid={Boolean(errors[name])}
        {...form.register(name)}
      />
      {description && !errors[name] && (
        <FieldDescription>{description}</FieldDescription>
      )}
      <FieldError errors={[errors[name]]} />
    </Field>
  );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Site identity</CardTitle>
          <CardDescription>
            Shown in the header, page titles, the RSS feed, and social preview
            images.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {text("name", "Site name")}
            {text("tagline", "Tagline", "The large headline on the home page.")}
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                rows={3}
                aria-invalid={Boolean(errors.description)}
                {...form.register("description")}
              />
              {!errors.description && (
                <FieldDescription>
                  Used for search engines and under the home page headline.
                </FieldDescription>
              )}
              <FieldError errors={[errors.description]} />
            </Field>
            {text(
              "ownerName",
              "Owner name",
              "Shown in the footer copyright. Leave blank to use the site name.",
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social links</CardTitle>
          <CardDescription>
            Filled-in links appear in the site footer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {SOCIAL_LINKS.map(({ key, label }) => (
              <Field key={key} data-invalid={Boolean(errors.links?.[key])}>
                <FieldLabel htmlFor={`link-${key}`}>{label}</FieldLabel>
                <Input
                  id={`link-${key}`}
                  type="url"
                  placeholder="https://"
                  aria-invalid={Boolean(errors.links?.[key])}
                  {...form.register(`links.${key}`)}
                />
                <FieldError errors={[errors.links?.[key]]} />
              </Field>
            ))}
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
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
