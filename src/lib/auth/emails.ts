import "server-only";

import {
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

/** Better Auth `emailVerification.sendVerificationEmail`. */
export async function sendVerificationLink(user: Recipient, url: string) {
  // e.g. invited team members, who are verified when their account is made.
  if (user.emailVerified) return;
  if (!(await consumeRateLimit(`email:verify:${user.id}`, PER_HOUR))) return;
  const site = await getSiteSettings();
  await sendEmail({
    to: user.email,
    tag: "verify-email",
    ...verifyEmailMessage({ siteName: site.name, name: user.name, url }),
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
