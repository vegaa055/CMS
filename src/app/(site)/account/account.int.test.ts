/**
 * Account self-service against the real Better Auth instance and database,
 * with real sessions: name, password, email change, and deletion. Emails
 * are captured instead of sent. Only touches `int-acct-*` users.
 * Run with `npm run test:int`.
 */
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray, like, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { account, rateLimit, session, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { EmailMessage } from "@/lib/email";

import { changePassword, setPassword, updateName } from "./actions";

const sent: EmailMessage[] = [];
/** The session cookie `headers()` hands to the server actions. */
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
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: vi.fn(async (message: EmailMessage) => {
    sent.push(message);
  }),
}));

const P = "int-acct";
const PASSWORD = "long-enough-pw";
const idOf = (name: string) => `${P}-${name}`;
const email = (name: string) => `${idOf(name)}@folio.local`;

async function createUser(
  name: string,
  {
    role = "reader" as const,
    verified = false,
  }: { role?: "reader" | "admin"; verified?: boolean } = {},
) {
  await db.insert(user).values({
    id: idOf(name),
    name,
    email: email(name),
    role,
    emailVerified: verified,
  });
  await db.insert(account).values({
    id: `${idOf(name)}-credential`,
    accountId: idOf(name),
    providerId: "credential",
    userId: idOf(name),
    password: await hashPassword(PASSWORD),
  });
}

/** Sign in for real and use that session from now on. */
async function signInAs(name: string, password = PASSWORD) {
  const { headers } = await auth.api.signInEmail({
    body: { email: email(name), password },
    returnHeaders: true,
  });
  cookie = headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return new Headers({ cookie });
}

async function nextEmail(to: string, tag: string) {
  let found: EmailMessage | undefined;
  await vi.waitFor(() => {
    found = sent.find((m) => m.to === to && m.tag === tag);
    expect(found).toBeDefined();
  });
  sent.splice(sent.indexOf(found!), 1);
  return new URL(found!.text.match(/https?:\/\/\S+/)![0]);
}

async function cleanup() {
  const ids = (
    await db
      .select({ id: user.id })
      .from(user)
      .where(like(user.id, `${P}-%`))
  ).map((u) => u.id);
  if (ids.length) {
    await db.delete(rateLimit).where(
      inArray(
        rateLimit.key,
        ids.flatMap((id) =>
          ["verify", "reset", "change"].map((k) => `app:email:${k}:${id}`),
        ),
      ),
    );
  }
  await db.delete(user).where(like(user.id, `${P}-%`));
}

const otherAdmins = await db
  .select({ id: user.id })
  .from(user)
  .where(and(eq(user.role, "admin"), ne(user.id, idOf("admin"))));

beforeAll(cleanup);
afterAll(cleanup);

describe("display name", () => {
  it("is editable by its owner, readers included", async () => {
    await createUser("namer");
    await signInAs("namer");
    expect((await updateName({ name: "  " })).ok).toBe(false);
    expect(await updateName({ name: "New Name" })).toEqual({
      ok: true,
      data: null,
    });
    const row = await db.query.user.findFirst({
      where: eq(user.id, idOf("namer")),
    });
    expect(row?.name).toBe("New Name");
  });

  it("needs a session", async () => {
    cookie = "";
    expect((await updateName({ name: "Nobody" })).ok).toBe(false);
  });
});

describe("password", () => {
  it("changes with the current password and signs out other devices", async () => {
    await createUser("changer");
    await signInAs("changer"); // another device
    await signInAs("changer");
    expect(
      await changePassword({
        currentPassword: "not-the-password",
        newPassword: "another-long-pw",
        confirmPassword: "another-long-pw",
      }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { currentPassword: expect.any(String) },
    });

    expect(
      (
        await changePassword({
          currentPassword: PASSWORD,
          newPassword: "another-long-pw",
          confirmPassword: "another-long-pw",
        })
      ).ok,
    ).toBe(true);
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, idOf("changer")));
    expect(sessions).toHaveLength(1);
    await signInAs("changer", "another-long-pw");
  });

  it("can be added to an account that has none (GitHub-only)", async () => {
    await createUser("github");
    await signInAs("github");
    // Now pretend they only ever signed in with GitHub.
    await db
      .update(account)
      .set({ password: null })
      .where(eq(account.userId, idOf("github")));
    expect(
      (
        await setPassword({
          newPassword: "first-password-ok",
          confirmPassword: "first-password-ok",
        })
      ).ok,
    ).toBe(true);
    await signInAs("github", "first-password-ok");
    // A second time is refused: there's a password now.
    expect(
      (
        await setPassword({
          newPassword: "another-one-here",
          confirmPassword: "another-one-here",
        })
      ).ok,
    ).toBe(false);
  });
});

describe("email change", () => {
  it("confirms from the old inbox, then verifies the new one", async () => {
    await createUser("mover", { verified: true });
    const headers = await signInAs("mover");
    await auth.api.changeEmail({
      body: {
        newEmail: email("moved"),
        callbackURL: "/account?emailChange=sent",
      },
      headers,
    });
    const confirm = await nextEmail(email("mover"), "confirm-email-change");
    expect(confirm.searchParams.get("callbackURL")).toBe(
      "/account?emailChange=sent",
    );
    await auth.api.verifyEmail({
      query: { token: confirm.searchParams.get("token")! },
    });

    const verify = await nextEmail(email("moved"), "change-email");
    expect(verify.searchParams.get("callbackURL")).toBe(
      "/account?emailChange=done",
    );
    // Not changed until the new inbox confirms.
    expect(
      (await db.query.user.findFirst({ where: eq(user.id, idOf("mover")) }))
        ?.email,
    ).toBe(email("mover"));
    await auth.api.verifyEmail({
      query: { token: verify.searchParams.get("token")! },
    });
    expect(
      await db.query.user.findFirst({ where: eq(user.id, idOf("mover")) }),
    ).toMatchObject({ email: email("moved"), emailVerified: true });
  });

  it("goes straight to the new inbox when the old one was never confirmed", async () => {
    await createUser("unconfirmed");
    const headers = await signInAs("unconfirmed");
    await auth.api.changeEmail({
      body: {
        newEmail: email("unconfirmed-new"),
        callbackURL: "/account?emailChange=sent",
      },
      headers,
    });
    const verify = await nextEmail(email("unconfirmed-new"), "change-email");
    await auth.api.verifyEmail({
      query: { token: verify.searchParams.get("token")! },
    });
    expect(
      await db.query.user.findFirst({
        where: eq(user.id, idOf("unconfirmed")),
      }),
    ).toMatchObject({ email: email("unconfirmed-new"), emailVerified: true });
  });
});

describe("deleting an account", () => {
  it("needs the right password", async () => {
    await createUser("keeper");
    const headers = await signInAs("keeper");
    await expect(
      auth.api.deleteUser({ body: { password: "wrong-password" }, headers }),
    ).rejects.toThrow();
    expect(
      await db.query.user.findFirst({ where: eq(user.id, idOf("keeper")) }),
    ).toBeDefined();
  });

  it("removes the user, their sessions, and their email limits", async () => {
    await createUser("leaver");
    const headers = await signInAs("leaver");
    await db.insert(rateLimit).values({
      id: crypto.randomUUID(),
      key: `app:email:verify:${idOf("leaver")}`,
      count: 1,
      lastRequest: Date.now(),
    });
    await auth.api.deleteUser({ body: { password: PASSWORD }, headers });
    expect(
      await db.query.user.findFirst({ where: eq(user.id, idOf("leaver")) }),
    ).toBeUndefined();
    expect(
      await db
        .select()
        .from(session)
        .where(eq(session.userId, idOf("leaver"))),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(rateLimit)
        .where(eq(rateLimit.key, `app:email:verify:${idOf("leaver")}`)),
    ).toEqual([]);
  });

  // Only meaningful when no real admin exists (CI's fresh database).
  it.runIf(otherAdmins.length === 0)(
    "won't delete the last admin",
    async () => {
      await createUser("admin", { role: "admin" });
      const headers = await signInAs("admin");
      await expect(
        auth.api.deleteUser({ body: { password: PASSWORD }, headers }),
      ).rejects.toThrow(/only admin/);
      expect(
        await db.query.user.findFirst({ where: eq(user.id, idOf("admin")) }),
      ).toBeDefined();
    },
  );
});
