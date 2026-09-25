import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || z.url({ protocol: /^https?$/ }).safeParse(v).success,
    {
      message: "Enter a full URL starting with https://",
    },
  );

/** Editable site identity (stored in the `settings` table). */
export const siteSettingsSchema = z.object({
  name: z.string().trim().min(1, "Site name is required").max(60),
  tagline: z.string().trim().min(1, "Tagline is required").max(120),
  description: z.string().trim().min(1, "Description is required").max(300),
  ownerName: z.string().trim().max(80),
  links: z.object({
    github: optionalUrl,
    x: optionalUrl,
    linkedin: optionalUrl,
    website: optionalUrl,
  }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const SOCIAL_LINKS = [
  { key: "github", label: "GitHub" },
  { key: "x", label: "X / Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
] as const satisfies { key: keyof SiteSettings["links"]; label: string }[];
