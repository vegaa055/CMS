import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { hashPassword } from "better-auth/crypto";

import { cleanupE2E, E2E, sql } from "./db";

/** Create a fresh e2e admin with a random password for this run. */
export default async function globalSetup() {
  await cleanupE2E();
  const password = randomBytes(18).toString("base64url");
  const db = sql();
  await db`
    insert into "user" (id, name, email, email_verified, role, username)
    values (${E2E.userId}, ${E2E.name}, ${E2E.email}, true, 'admin', 'e2e-admin')`;
  await db`
    insert into account (id, account_id, provider_id, user_id, password)
    values (${`${E2E.userId}-credential`}, ${E2E.userId}, 'credential', ${E2E.userId}, ${await hashPassword(password)})`;
  await mkdir("e2e/.auth", { recursive: true });
  await writeFile(
    E2E.credentialsFile,
    JSON.stringify({ email: E2E.email, password }),
  );
}
