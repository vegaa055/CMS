import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { captcha, haveIBeenPwned } from "better-auth/plugins";
import { and, count, eq, like } from "drizzle-orm";

import { siteConfig } from "@/config/site";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";
import { runAfterResponse } from "@/lib/background";
import { revalidatePublicSite } from "@/lib/revalidate";
import { getReaderSettings } from "@/lib/settings";

import {
  sendEmailChangeConfirmation,
  sendPasswordResetLink,
  sendVerificationLink,
} from "./emails";
import { inviteContext } from "./invite-context";
import { withWwwVariant } from "./origins";
import { isRole, isStaff } from "./permissions";

export const githubEnabled = Boolean(
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET,
);

/**
 * Cloudflare Turnstile guards sign-up and password reset when both keys are
 * set. Forms render the widget only with this site key, so the two can't
 * disagree.
 */
export const captchaSiteKey =
  env.TURNSTILE_SECRET_KEY && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    ? env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    : undefined;
const CAPTCHA_ENDPOINTS = ["/sign-up/email", "/request-password-reset"];

/** Hooks get the core user type; our `role` field is there at runtime. */
function roleOf(user: object) {
  const role = (user as { role?: unknown }).role;
  return isRole(role) ? role : undefined;
}

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
  // Its client API would let anyone set their own avatar URL (e.g. a
  // tracking pixel shown to admins); profiles change only through our
  // validated server actions.
  disabledPaths: ["/update-user"],
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
    // A verified address is confirmed from the old inbox first, then the
    // new one; an unverified address only needs the new inbox.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: ({ user, newEmail, url }) =>
        sendEmailChangeConfirmation(user, newEmail, url),
    },
    // Deleting takes the password (or, without one, a session under a day
    // old). Sessions and sign-in accounts cascade; posts and uploads stay,
    // unattributed.
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        if (roleOf(user) !== "admin") return;
        const [admins] = await db
          .select({ value: count() })
          .from(schema.user)
          .where(eq(schema.user.role, "admin"));
        if ((admins?.value ?? 0) <= 1) {
          throw new APIError("BAD_REQUEST", {
            message:
              "You're the only admin. Make someone else an admin before deleting your account.",
          });
        }
      },
      afterDelete: async (user) => {
        // Per-recipient email limits (app:email:<kind>:<user id>).
        await db
          .delete(schema.rateLimit)
          .where(
            and(
              like(schema.rateLimit.key, "app:email:%"),
              like(schema.rateLimit.key, `%:${user.id}`),
            ),
          );
        // Their byline and author page, if they were on the team.
        if (isStaff(roleOf(user))) revalidatePublicSite();
      },
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
      // Checks the password, so it mustn't allow guessing.
      "/delete-user": { window: 60, max: 5 },
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
  plugins: [
    ...(captchaSiteKey
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: env.TURNSTILE_SECRET_KEY!,
            endpoints: CAPTCHA_ENDPOINTS,
          }),
        ]
      : []),
    // Rejects passwords found in data breaches (only a 5-character hash
    // prefix is sent to Have I Been Pwned). Off in unit/integration tests,
    // which shouldn't depend on an outside service.
    haveIBeenPwned({
      enabled: env.NODE_ENV !== "test",
      paths: [
        "/sign-up/email",
        "/change-password",
        "/reset-password",
        "/set-password",
      ],
      customPasswordCompromisedMessage:
        "This password has appeared in a data breach. Please choose a different one.",
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
