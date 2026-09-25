import "server-only";

import { inArray, sql } from "drizzle-orm";
import { cache } from "react";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  siteSettingsSchema,
  type SiteSettings,
} from "@/lib/validation/settings";

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

const KEYS = {
  name: "site.name",
  tagline: "site.tagline",
  description: "site.description",
  ownerName: "site.ownerName",
  links: "site.links",
} as const satisfies Record<keyof SiteSettings, string>;

/**
 * Current site settings (deduplicated per request). Invalid or missing
 * stored values fall back to defaults field by field.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, Object.values(KEYS)));
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  const merged = {
    ...DEFAULT_SITE_SETTINGS,
    ...Object.fromEntries(
      (Object.keys(KEYS) as (keyof SiteSettings)[])
        .filter((field) => stored.has(KEYS[field]))
        .map((field) => [field, stored.get(KEYS[field])]),
    ),
  };
  merged.links = { ...DEFAULT_SITE_SETTINGS.links, ...(merged.links ?? {}) };

  const parsed = siteSettingsSchema.safeParse(merged);
  if (parsed.success) return parsed.data;
  // Keep valid fields; reset only the broken ones.
  const broken = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [
      k,
      broken.has(k) ? DEFAULT_SITE_SETTINGS[k as keyof SiteSettings] : v,
    ]),
  ) as SiteSettings;
});

export async function saveSiteSettings(values: SiteSettings) {
  const rows = (Object.keys(KEYS) as (keyof SiteSettings)[]).map((field) => ({
    key: KEYS[field],
    value: values[field],
  }));
  await db
    .insert(settings)
    .values(rows)
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
}
