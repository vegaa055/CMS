import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed, validated environment variables. Import `env` instead of reading
 * `process.env` directly so a missing variable fails loudly at startup.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    /**
     * Media storage backend. "local" writes to ./.uploads (development only);
     * "r2" uses Cloudflare R2 with presigned direct uploads.
     */
    STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_URL: z.url().optional(),
    /**
     * Outgoing email. "console" logs messages and saves them to ./.emails
     * (development and CI); "resend" delivers through Resend.
     */
    EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
    RESEND_API_KEY: z.string().optional(),
    /** Sender address on a domain verified in Resend, e.g. hello@example.com. */
    EMAIL_FROM: z.email().optional(),
    /**
     * Cloudflare Turnstile secret. With NEXT_PUBLIC_TURNSTILE_SITE_KEY, it
     * puts a bot check on sign-up and password reset; unset, there's none.
     */
    TURNSTILE_SECRET_KEY: z.string().optional(),
    /**
     * Vercel Cron sends it as a bearer token to /api/cron/*; unset, the
     * scheduled jobs (the moderators' daily digest) don't run.
     */
    CRON_SECRET: z.string().min(16).optional(),
  },
  client: {
    // Optional: see resolveAppUrl() in src/config/site.ts.
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    STORAGE_DRIVER: process.env.STORAGE_DRIVER,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET: process.env.R2_BUCKET,
    R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
    EMAIL_DRIVER: process.env.EMAIL_DRIVER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },
  emptyStringAsUndefined: true,
  // Lets CI lint/typecheck without real secrets.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
