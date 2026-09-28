import "server-only";

import { env } from "@/env";
import { getSiteSettings } from "@/lib/settings";

import { writeToOutbox } from "./outbox";
import { fromHeader, isDeliverableAddress } from "./recipients";
import { sendWithResend } from "./resend";
import type { EmailContent } from "./templates";

export type EmailMessage = EmailContent & {
  to: string;
  /** Short category for logs and Resend tags, e.g. "reset-password". */
  tag: string;
};

/**
 * Send one email. With EMAIL_DRIVER=resend it's delivered for real, except
 * to reserved test domains (e.g. @folio.local), which, like everything with
 * the console driver, go to the local outbox. Throws if delivery fails.
 */
export async function sendEmail(message: EmailMessage) {
  const site = await getSiteSettings();

  if (env.EMAIL_DRIVER === "resend") {
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      throw new Error(
        "EMAIL_DRIVER=resend needs RESEND_API_KEY and EMAIL_FROM.",
      );
    }
    const from = fromHeader(site.name, env.EMAIL_FROM);
    if (isDeliverableAddress(message.to)) {
      return sendWithResend(message, from, env.RESEND_API_KEY);
    }
    return writeToOutbox(message, from);
  }

  if (process.env.VERCEL_ENV === "production") {
    // Password resets would silently go nowhere.
    throw new Error(
      `Email isn't configured in production (EMAIL_DRIVER=console); "${message.subject}" to ${message.to} was not sent.`,
    );
  }
  return writeToOutbox(
    message,
    fromHeader(site.name, env.EMAIL_FROM ?? "noreply@localhost"),
  );
}

export * from "./templates";
