import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { EmailMessage } from "./index";

/** Where development and CI "send" email: one JSON file per message. */
export const OUTBOX_DIR = path.join(process.cwd(), ".emails");

/**
 * Log the message and, off Vercel (read-only filesystem), save it so you
 * (or an e2e test) can open its links.
 */
export async function writeToOutbox(message: EmailMessage, from: string) {
  const onVercel = Boolean(process.env.VERCEL);
  // Links carry tokens, so they're only printed locally.
  const link = onVercel
    ? ""
    : (message.text.match(/https?:\/\/\S+/)?.[0] ?? "");
  console.info(
    `[email] ${message.tag} → ${message.to}: ${message.subject}${link ? `\n        ${link}` : ""}`,
  );
  if (onVercel) return;

  await mkdir(OUTBOX_DIR, { recursive: true });
  const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, "_");
  const file = `${Date.now()}-${message.tag}-${safeTo}.json`;
  await writeFile(
    path.join(OUTBOX_DIR, file),
    JSON.stringify(
      { ...message, from, sentAt: new Date().toISOString() },
      null,
      2,
    ),
  );
}
