import "server-only";

import { inArray, sql } from "drizzle-orm";
import { cache } from "react";
import type { z } from "zod";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  commentSettingsSchema,
  readerSettingsSchema,
  siteSettingsSchema,
  type CommentSettings,
  type ReaderSettings,
  type SiteSettings,
} from "@/lib/validation/settings";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A group of settings stored one row per field, keyed `<prefix>.<field>`.
 * Reads are deduplicated per request; invalid or missing stored values fall
 * back to the defaults field by field.
 */
function settingsGroup<T extends Record<string, unknown>>(
  prefix: string,
  schema: z.ZodType<T>,
  defaults: T,
) {
  const fields = Object.keys(defaults) as (keyof T & string)[];
  const keyOf = (field: string) => `${prefix}.${field}`;

  const get = cache(async (): Promise<T> => {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, fields.map(keyOf)));
    const stored = new Map(rows.map((r) => [r.key, r.value]));

    const merged = Object.fromEntries(
      fields.map((field) => {
        const fallback = defaults[field];
        if (!stored.has(keyOf(field))) return [field, fallback];
        const value = stored.get(keyOf(field));
        // Nested objects (e.g. social links) merge over their defaults, so
        // fields added later get default values.
        return [
          field,
          isPlainObject(fallback) && isPlainObject(value)
            ? { ...fallback, ...value }
            : value,
        ];
      }),
    ) as T;

    const parsed = schema.safeParse(merged);
    if (parsed.success) return parsed.data;
    // Keep valid fields; reset only the broken ones.
    const broken = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    return Object.fromEntries(
      fields.map((field) => [
        field,
        broken.has(field) ? defaults[field] : merged[field],
      ]),
    ) as T;
  });

  async function save(values: T) {
    await db
      .insert(settings)
      .values(
        fields.map((field) => ({ key: keyOf(field), value: values[field] })),
      )
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  }

  return { get, save };
}

/** Defaults come from `src/config/site.ts`; stored values override them. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  name: siteConfig.name,
  tagline: siteConfig.tagline,
  description: siteConfig.description,
  ownerName: siteConfig.author.name,
  links: {
    github: siteConfig.links.github,
    x: "",
    linkedin: "",
    website: "",
  },
};

const siteSettings = settingsGroup(
  "site",
  siteSettingsSchema,
  DEFAULT_SITE_SETTINGS,
);

/** Site identity and links. */
export const getSiteSettings = siteSettings.get;
export const saveSiteSettings = siteSettings.save;

/** Reader sign-up starts closed; admins open it in Settings. */
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  signupEnabled: false,
};

const readerSettings = settingsGroup(
  "readers",
  readerSettingsSchema,
  DEFAULT_READER_SETTINGS,
);

/** Reader accounts: whether the public can sign up. */
export const getReaderSettings = readerSettings.get;
export const saveReaderSettings = readerSettings.save;

/**
 * Comments start off; admins turn them on in Settings. By default a
 * reader's first comment waits for approval and later ones publish.
 */
export const DEFAULT_COMMENT_SETTINGS: CommentSettings = {
  enabled: false,
  moderation: "first",
};

const commentSettings = settingsGroup(
  "comments",
  commentSettingsSchema,
  DEFAULT_COMMENT_SETTINGS,
);

export const getCommentSettings = commentSettings.get;
export const saveCommentSettings = commentSettings.save;
