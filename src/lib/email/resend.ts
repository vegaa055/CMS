import "server-only";

import type { EmailMessage } from "./index";

/** Deliver through Resend's REST API (no SDK needed for one endpoint). */
export async function sendWithResend(
  message: EmailMessage,
  from: string,
  apiKey: string,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      tags: [{ name: "category", value: message.tag }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend rejected the email (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
}
