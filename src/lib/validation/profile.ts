import { z } from "zod";

/** Paths under /authors that must never be claimed as usernames. */
const RESERVED = new Set(["admin", "api", "new", "edit", "settings", "me"]);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(30, "At most 30 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Lowercase letters, numbers, and single hyphens",
  )
  .refine((v) => !RESERVED.has(v), "That username is reserved");

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  // Empty = no public author page.
  username: z.union([z.literal(""), usernameSchema]),
  bio: z.string().trim().max(500, "Keep your bio under 500 characters"),
  image: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (v) => v === "" || v.startsWith("/") || /^https:\/\//.test(v),
      "Invalid image URL",
    ),
});

export type ProfileInput = z.input<typeof profileSchema>;

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(10, "Use at least 10 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type PasswordInput = z.infer<typeof passwordSchema>;
