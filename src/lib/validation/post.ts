import { z } from "zod";

import { POST_STATUSES } from "@/lib/posts/status";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Payload accepted by the `savePost` server action. */
export const savePostSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().max(200, "Keep the title under 200 characters"),
  slug: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || SLUG_PATTERN.test(v), {
      message: "Use lowercase letters, numbers, and single hyphens",
    }),
  excerpt: optionalText(500),
  // Structure is validated against the editor schema by `sanitizeDoc`.
  content: z.unknown(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20, "Up to 20 tags"),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  status: z.enum(POST_STATUSES),
  publishedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});

export type SavePostInput = z.input<typeof savePostSchema>;

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  slug: z
    .string()
    .trim()
    .max(60)
    .refine((v) => v === "" || SLUG_PATTERN.test(v), {
      message: "Use lowercase letters, numbers, and single hyphens",
    }),
});

export type TagInput = z.input<typeof tagSchema>;
