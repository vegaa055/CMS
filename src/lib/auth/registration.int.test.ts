/**
 * Who can sign up, against the real DB (the Better Auth hook in
 * `src/lib/auth/index.ts`). Only touches `int-reg-*` users and restores the
 * reader settings it changes. Run with `npm run test:int`.
 */
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { rateLimit, settings, user } from "@/db/schema";
import { auth, registrationMode } from "@/lib/auth";
import { saveReaderSettings } from "@/lib/settings";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));
// Sign-ups send a verification email; nothing to deliver here.
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: vi.fn(async () => {}),
}));

const P = "int-reg";
const email = (name: string) => `${P}-${name}@folio.local`;
const password = "long-enough-pw";

const signUp = (name: string, extra: Record<string, unknown> = {}) =>
  auth.api.signUpEmail({
    body: { email: email(name), name, password, ...extra } as never,
  });

const roleOf = async (name: string) =>
  (await db.query.user.findFirst({ where: eq(user.email, email(name)) }))?.role;

let savedSettings: (typeof settings.$inferSelect)[] = [];
// On CI's fresh database nobody is admin yet, so the first sign-up there
// really does become admin; on a dev DB with an admin, it's skipped.
const noAdminYet = !(await db.query.user.findFirst({
  where: eq(user.role, "admin"),
}));

async function cleanup() {
  const ours = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, `${P}-%`));
  if (ours.length) {
    // Their per-recipient email limits (app:email:verify:<user id>).
    await db.delete(rateLimit).where(
      inArray(
        rateLimit.key,
        ours.map((u) => `app:email:verify:${u.id}`),
      ),
    );
  }
  await db.delete(user).where(like(user.email, `${P}-%`));
}

beforeAll(async () => {
  savedSettings = await db
    .select()
    .from(settings)
    .where(like(settings.key, "readers.%"));
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.delete(settings).where(like(settings.key, "readers.%"));
  if (savedSettings.length) await db.insert(settings).values(savedSettings);
});

describe.runIf(noAdminYet)("on a brand-new site", () => {
  it("makes the first account the admin", async () => {
    expect(await registrationMode()).toBe("first-admin");
    await signUp("first");
    expect(await roleOf("first")).toBe("admin");
  });
});

describe("once an admin exists", () => {
  it("is closed while reader sign-up is off", async () => {
    await saveReaderSettings({ signupEnabled: false });
    expect(await registrationMode()).toBe("closed");
    await expect(signUp("closed")).rejects.toThrow(/closed/i);
    expect(await roleOf("closed")).toBeUndefined();
  });

  it("creates readers, never staff, while it's on", async () => {
    await saveReaderSettings({ signupEnabled: true });
    expect(await registrationMode()).toBe("readers");
    await signUp("reader");
    expect(await roleOf("reader")).toBe("reader");
  });

  it("ignores a role sent by the client", async () => {
    await saveReaderSettings({ signupEnabled: true });
    // Better Auth rejects `role` outright (input: false); either way the
    // account must not come out as admin.
    await signUp("sneaky", { role: "admin" }).catch(() => null);
    expect(await roleOf("sneaky")).not.toBe("admin");
  });
});
