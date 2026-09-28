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
import { runAfterResponse } from "@/lib/background";
import { getReaderSettings } from "@/lib/settings";

import { sendPasswordResetLink, sendVerificationLink } from "./emails";
import { inviteContext } from "./invite-context";
import { withWwwVariant } from "./origins";

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

export type RegistrationMode = "first-admin" | "readers" | "closed";

/**
 * Who may create an account right now, invitations aside (those always
 * work). Applies to every sign-up path, including first-time GitHub sign-in:
 * - "first-admin": no admin exists yet, so the next account becomes admin;
 * - "readers": reader sign-up is on in Settings; new accounts are readers;
 * - "closed": nobody.
 */
export async function registrationMode(): Promise<RegistrationMode> {
  if (!(await hasAdmin())) return "first-admin";
  return (await getReaderSettings()).signupEnabled ? "readers" : "closed";
}

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: siteConfig.url,
  // Also accept the deployment's own URLs (per-deployment and branch URLs
  // for previews) and both the apex and www forms of the production domain,
  // since one usually redirects to the other.
  trustedOrigins: [
    ...withWwwVariant(siteConfig.url),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? withWwwVariant(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
      : []),
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
    // Reset links last an hour (the default); using one signs the account
    // out everywhere.
    sendResetPassword: ({ user, url }) => sendPasswordResetLink(user, url),
    revokeSessionsOnPasswordReset: true,
  },
  // Readers can sign in before verifying; a verified email is only needed
  // for commenting. Verification links don't sign anyone in, so a leaked
  // link can't be used as a login.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: ({ user, url }) => sendVerificationLink(user, url),
  },
  advanced: {
    // Emails are sent after the response, so response times don't reveal
    // whether an account exists; after() keeps the function alive on Vercel.
    backgroundTasks: { handler: runAfterResponse },
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
      // input: false — clients can never set their own role. The sign-up
      // hook below always sets it; the default is only a least-privilege net.
      role: { type: "string", input: false, defaultValue: "reader" },
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
      "/reset-password": { window: 60, max: 5 },
      // Built in: reset and verification requests are limited to 3 per
      // minute per IP; `./emails` also caps them per recipient.
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
            // An admin invited this address, so treat it as verified (and
            // skip the verification email).
            return {
              data: { ...user, role: invite.role, emailVerified: true },
            };
          }
          const mode = await registrationMode();
          if (mode === "closed") {
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed right now.",
            });
          }
          // Open sign-up only ever creates readers; staff join by invite.
          return {
            data: {
              ...user,
              role: mode === "first-admin" ? "admin" : "reader",
            },
          };
        },
      },
    },
  },
  plugins: [nextCookies()], // must stay last
});

export type Session = typeof auth.$Infer.Session;
