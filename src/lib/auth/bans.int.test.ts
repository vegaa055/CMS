/**
 * Bans against the real Better Auth instance, with real sessions: a banned
 * reader is signed out, can't sign in again, and counts as signed out even
 * with a session that slipped through. Only touches `int-ban-*` users.
 * Run with `npm run test:int`.
 */
import { hashPassword } from "better-auth/crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { account, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { banReader, unbanReader } from "@/lib/comments/moderation";

/** The session cookie `headers()` hands to `getSession()`. */
let cookie = "";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(cookie ? { cookie } : undefined),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));

const P = "int-ban";
const ID = `${P}-reader`;
const EMAIL = `${ID}@folio.local`;
const PASSWORD = "long-enough-pw";

async function signIn() {
  const { headers } = await auth.api.signInEmail({
    body: { email: EMAIL, password: PASSWORD },
    returnHeaders: true,
  });
  cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function cleanup() {
  await db.delete(user).where(like(user.id, `${P}-%`));
}

beforeAll(async () => {
  await cleanup();
  await db.insert(user).values({
    id: ID,
    name: "Int Ban",
    email: EMAIL,
    role: "reader",
    emailVerified: true,
  });
  await db.insert(account).values({
    id: `${ID}-credential`,
    accountId: ID,
    providerId: "credential",
    userId: ID,
    password: await hashPassword(PASSWORD),
  });
});

afterAll(cleanup);

describe("a banned reader", () => {
  it("is signed out and can't sign back in until unbanned", async () => {
    await signIn();
    expect((await getSession())?.user.id).toBe(ID);

    expect(await banReader(ID, { reason: null, hideComments: false })).toBe(
      true,
    );
    expect(await getSession()).toBeNull();
    await expect(signIn()).rejects.toThrow(/suspended/);

    expect(await unbanReader(ID)).toBe(true);
    await signIn();
    expect((await getSession())?.user.id).toBe(ID);
  });

  it("counts as signed out even with a session that slipped through", async () => {
    await signIn();
    // Banned without the sessions being cleared (e.g. signing in mid-ban).
    await db.update(user).set({ bannedAt: new Date() }).where(eq(user.id, ID));
    expect(await getSession()).toBeNull();
  });
});
