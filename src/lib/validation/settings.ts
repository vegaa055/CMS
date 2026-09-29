import { z } from "zod";

import { COMMENT_MODERATION } from "@/lib/comments";

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

/** Reader accounts (stored in the `settings` table under `readers.*`). */
export const readerSettingsSchema = z.object({
  /** Anyone may create a reader account at /register. */
  signupEnabled: z.boolean(),
});

export type ReaderSettings = z.infer<typeof readerSettingsSchema>;

/** Comments (stored under `comments.*`). */
export const commentSettingsSchema = z.object({
  /** Site-wide: when off, existing comments stay visible but read-only. */
  enabled: z.boolean(),
  /** Which new reader comments wait for a moderator. */
  moderation: z.enum(COMMENT_MODERATION),
  /** Reader comments containing any of these wait for a moderator. */
  blockedWords: z
    .array(z.string().trim().min(1).max(100))
    .max(500, "Up to 500 words")
    // One entry per word, whatever the case.
    .transform((words) => [
      ...new Map(words.map((w) => [w.toLowerCase(), w])).values(),
    ]),
  /** Reader comments with this many links or more wait (0 turns it off). */
  linkLimit: z.number().int().min(0).max(20),
});

export type CommentSettings = z.infer<typeof commentSettingsSchema>;

export const SOCIAL_LINKS = [
  { key: "github", label: "GitHub" },
  { key: "x", label: "X / Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
] as const satisfies { key: keyof SiteSettings["links"]; label: string }[];
