import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";

export const githubEnabled = Boolean(
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET,
);

async function hasAdmin() {
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, "admin"))
    .limit(1);
  return Boolean(row);
}

/**
 * Registration policy: the very first account becomes admin (bootstrap).
 * After that, sign-up (including first-time OAuth) is closed unless
 * AUTH_ALLOW_SIGNUP=true. Invites arrive in Phase 7.
 */
export async function isRegistrationOpen() {
  return env.AUTH_ALLOW_SIGNUP || !(await hasAdmin());
}

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  // Neon's HTTP driver has no interactive transactions.
  database: drizzleAdapter(db, { provider: "pg", schema, transaction: false }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    autoSignIn: true,
  },
  socialProviders: githubEnabled
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID!,
          clientSecret: env.GITHUB_CLIENT_SECRET!,
        },
      }
    : undefined,
  user: {
    additionalFields: {
      // input: false — clients can never set their own role.
      role: { type: "string", input: false, defaultValue: "author" },
      bio: { type: "string", required: false },
    },
  },
  session: {
    // Cache the session in a signed cookie for 5 minutes to skip DB lookups.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!(await hasAdmin())) {
            return { data: { ...user, role: "admin" } };
          }
          if (!env.AUTH_ALLOW_SIGNUP) {
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed. Ask an admin for an invite.",
            });
          }
          return { data: { ...user, role: "author" } };
        },
      },
    },
  },
  plugins: [nextCookies()], // must stay last
});

export type Session = typeof auth.$Infer.Session;
