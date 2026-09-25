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

import { inviteContext } from "./invite-context";

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
 * AUTH_ALLOW_SIGNUP=true or the user is accepting an invitation.
 */
export async function isRegistrationOpen() {
  return env.AUTH_ALLOW_SIGNUP || !(await hasAdmin());
}

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: siteConfig.url,
  // Also accept the deployment's own URLs (Vercel previews).
  trustedOrigins: [
    siteConfig.url,
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
      .filter(Boolean)
      .map((host) => `https://${host}`),
  ],
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
      // Profile fields are edited only through our own server actions.
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
    },
  },
  // Enabled in production. Stored in Postgres: in-memory counters are
  // per-instance on serverless and would barely limit anything.
  rateLimit: {
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
    },
  },
  // No session cookie cache: every check reads the DB, so role changes and
  // removed users take effect on the very next request.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const invite = inviteContext.getStore();
          if (invite) {
            if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
              throw new APIError("FORBIDDEN", {
                message: "This invitation is for a different email address.",
              });
            }
            return { data: { ...user, role: invite.role } };
          }
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
