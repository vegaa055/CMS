import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { user as users } from "@/db/schema";
import { emailChangeUrl } from "@/lib/auth/landing";
import {
  emailChangeConfirmationMessage,
  newEmailMessage,
  resetPasswordMessage,
  sendEmail,
  verifyEmailMessage,
} from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/settings";

type Recipient = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};

/**
 * Per recipient, on top of Better Auth's per-IP limits: stops anyone from
 * flooding an inbox (or the Resend quota) from many addresses. Over the
 * limit, the email is quietly skipped; the response looks the same.
 */
const PER_HOUR = { max: 3, windowMs: 60 * 60 * 1000 };

function withCallback(url: string, callbackURL: string) {
  const link = new URL(url);
  link.searchParams.set("callbackURL", callbackURL);
  return link.href;
}

/**
 * Better Auth `emailVerification.sendVerificationEmail`. Besides confirming
 * a new account, it sends the final link of an email change, where `email`
 * is the new address (the stored one is still the old).
 */
export async function sendVerificationLink(user: Recipient, url: string) {
  const [stored] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, user.id));
  const changing = stored !== undefined && stored.email !== user.email;
  // e.g. invited team members, who are verified when their account is made.
  if (user.emailVerified && !changing) return;
  if (!(await consumeRateLimit(`email:verify:${user.id}`, PER_HOUR))) return;

  const site = await getSiteSettings();
  await sendEmail(
    changing
      ? {
          to: user.email,
          tag: "change-email",
          ...newEmailMessage({
            siteName: site.name,
            name: user.name,
            url: withCallback(url, emailChangeUrl("done")),
          }),
        }
      : {
          to: user.email,
          tag: "verify-email",
          ...verifyEmailMessage({ siteName: site.name, name: user.name, url }),
        },
  );
}

/**
 * Better Auth `user.changeEmail.sendChangeEmailConfirmation`: first step of
 * changing a verified address, sent to that (current) address.
 */
export async function sendEmailChangeConfirmation(
  user: Recipient,
  newEmail: string,
  url: string,
) {
  if (!(await consumeRateLimit(`email:change:${user.id}`, PER_HOUR))) return;
  const site = await getSiteSettings();
  await sendEmail({
    to: user.email,
    tag: "confirm-email-change",
    ...emailChangeConfirmationMessage({
      siteName: site.name,
      name: user.name,
      newEmail,
      url,
    }),
  });
}

/** Better Auth `emailAndPassword.sendResetPassword`. */
export async function sendPasswordResetLink(user: Recipient, url: string) {
  if (!(await consumeRateLimit(`email:reset:${user.id}`, PER_HOUR))) return;
  const site = await getSiteSettings();
  await sendEmail({
    to: user.email,
    tag: "reset-password",
    ...resetPasswordMessage({ siteName: site.name, name: user.name, url }),
  });
}
