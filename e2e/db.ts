import { rm } from "node:fs/promises";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// CI passes DATABASE_URL directly; locally it comes from .env.local.
config({ path: ".env.local", quiet: true });

export const E2E = {
  userId: "e2e-admin",
  // A realistic display name so README screenshots read naturally.
  name: "Jordan Ellis",
  email: "e2e-admin@folio.local",
  credentialsFile: "e2e/.auth/credentials.json",
  storageState: "e2e/.auth/admin.json",
} as const;

export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return neon(process.env.DATABASE_URL);
}

/** Remove everything the e2e suite creates (e2e-* users, posts, tags, media). */
export async function cleanupE2E() {
  const db = sql();
  const media = (await db`
    select m.key from media m join "user" u on u.id = m.uploaded_by_id
    where u.email like 'e2e-%@folio.local'`) as { key: string }[];
  for (const { key } of media) {
    // Local storage driver files (no-op for R2 / missing files).
    await rm(path.join(process.cwd(), ".uploads", key), { force: true });
  }
  await db`delete from media where uploaded_by_id in (select id from "user" where email like 'e2e-%@folio.local')`;
  await db`delete from posts where slug like 'e2e-%'`;
  await db`delete from tags where slug like 'e2e-%'`;
  await db`delete from invitation where email like 'e2e-%@folio.local'`;
  await db`delete from "user" where email like 'e2e-%@folio.local'`;
}
