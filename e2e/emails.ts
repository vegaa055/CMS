import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

/**
 * Emails to e2e addresses (@folio.local) never leave the machine: the app
 * saves them to ./.emails (see src/lib/email). This reads them back.
 */
const OUTBOX = path.join(process.cwd(), ".emails");

type SavedEmail = {
  to: string;
  tag: string;
  subject: string;
  text: string;
  sentAt: string;
};

async function newest(to: string, tag: string, since: number) {
  const names = await readdir(OUTBOX).catch(() => [] as string[]);
  const matches: SavedEmail[] = [];
  for (const name of names.filter((n) => n.endsWith(".json"))) {
    const mail = JSON.parse(
      await readFile(path.join(OUTBOX, name), "utf8"),
    ) as SavedEmail;
    if (
      mail.to === to &&
      mail.tag === tag &&
      Date.parse(mail.sentAt) >= since
    ) {
      matches.push(mail);
    }
  }
  return matches.sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
}

/** Wait for an email of this kind sent to `to` after `since` (ms). */
export async function waitForEmail(to: string, tag: string, since: number) {
  let mail: SavedEmail | undefined;
  await expect
    .poll(async () => (mail = await newest(to, tag, since)), {
      message: `a "${tag}" email to ${to}`,
    })
    .toBeTruthy();
  return mail!;
}

/** The first link in an email's plain-text version. */
export function linkIn(mail: SavedEmail) {
  const link = mail.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No link in "${mail.subject}"`);
  return link;
}
