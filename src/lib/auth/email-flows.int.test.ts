/**
 * Verification, password reset, and invite emails through the real Better
 * Auth instance and database. Sending is captured instead of delivered.
 * Only touches `int-mail-*` users; restores reader settings.
 * Run with `npm run test:int`.
 */
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { acceptInvite } from "@/app/(auth)/invite/actions";
import { createInvite } from "@/app/admin/users/actions";
import { db } from "@/db";
import { invitation, rateLimit, session, settings, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import type { EmailMessage } from "@/lib/email";
import { hashInviteToken, newInviteToken } from "@/lib/invites";
import { saveReaderSettings } from "@/lib/settings";

const sent: EmailMessage[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`REDIRECT ${to}`), { redirectTo: to });
  },
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: vi.fn(async (message: EmailMessage) => {
    sent.push(message);
  }),
}));

const P = "int-mail";
const email = (name: string) => `${P}-${name}@folio.local`;
const password = "long-enough-pw";

/** Emails go out in the background, so wait for them to arrive. */
async function nextEmail(to: string, tag: string) {
  let found: EmailMessage | undefined;
  await vi.waitFor(() => {
    found = sent.find((m) => m.to === to && m.tag === tag);
    expect(found).toBeDefined();
  });
  sent.splice(sent.indexOf(found!), 1);
  return found!;
}
const linkIn = (message: EmailMessage) =>
  new URL(message.text.match(/https?:\/\/\S+/)![0]);
const settle = () => new Promise((r) => setTimeout(r, 300));

let savedSettings: (typeof settings.$inferSelect)[] = [];

async function cleanup() {
  const ids = (
    await db
      .select({ id: user.id })
      .from(user)
      .where(like(user.email, `${P}-%`))
  ).map((u) => u.id);
  if (ids.length) {
    await db.delete(rateLimit).where(
      inArray(
        rateLimit.key,
        ids.flatMap((id) => [
          `app:email:verify:${id}`,
          `app:email:reset:${id}`,
        ]),
      ),
    );
  }
  await db.delete(invitation).where(like(invitation.email, `${P}-%`));
  await db.delete(user).where(like(user.email, `${P}-%`));
}

beforeAll(async () => {
  savedSettings = await db
    .select()
    .from(settings)
    .where(like(settings.key, "readers.%"));
  await cleanup();
  await saveReaderSettings({ signupEnabled: true });
});

afterAll(async () => {
  await cleanup();
  await db.delete(settings).where(like(settings.key, "readers.%"));
  if (savedSettings.length) await db.insert(settings).values(savedSettings);
});

describe("email verification", () => {
  it("sends new readers a link that confirms their address", async () => {
    await auth.api.signUpEmail({
      body: {
        email: email("reader"),
        name: "Mail Reader",
        password,
        callbackURL: "/verify-email?next=%2Fposts",
      },
    });
    const message = await nextEmail(email("reader"), "verify-email");
    expect(message.subject).toMatch(/^Confirm your email/);
    const link = linkIn(message);
    expect(link.pathname).toBe("/api/auth/verify-email");
    expect(link.searchParams.get("callbackURL")).toBe(
      "/verify-email?next=%2Fposts",
    );

    await auth.api.verifyEmail({
      query: { token: link.searchParams.get("token")! },
    });
    const row = await db.query.user.findFirst({
      where: eq(user.email, email("reader")),
    });
    expect(row?.emailVerified).toBe(true);
  });

  it("treats invited team members as verified and sends them nothing", async () => {
    const token = newInviteToken();
    await db.insert(invitation).values({
      id: crypto.randomUUID(),
      email: email("invitee"),
      role: "author",
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await expect(
      acceptInvite(token, { name: "Mail Invitee", password }),
    ).rejects.toThrow(/REDIRECT \/admin/);
    await settle();
    expect(sent.filter((m) => m.to === email("invitee"))).toEqual([]);
    const row = await db.query.user.findFirst({
      where: eq(user.email, email("invitee")),
    });
    expect(row).toMatchObject({ role: "author", emailVerified: true });
  });
});

describe("password reset", () => {
  it("emails a one-hour link that sets a new password and signs out everywhere", async () => {
    await auth.api.signUpEmail({
      body: { email: email("forgetful"), name: "Forgetful", password },
    });
    await nextEmail(email("forgetful"), "verify-email");
    const { user: signedIn } = await auth.api.signInEmail({
      body: { email: email("forgetful"), password },
    });

    await auth.api.requestPasswordReset({
      body: { email: email("forgetful"), redirectTo: "/reset-password" },
    });
    const message = await nextEmail(email("forgetful"), "reset-password");
    const link = linkIn(message);
    // /api/auth/reset-password/<token>?callbackURL=%2Freset-password
    const token = link.pathname.split("/").pop()!;
    expect(link.searchParams.get("callbackURL")).toBe("/reset-password");

    await auth.api.resetPassword({
      body: { token, newPassword: "a-brand-new-password" },
    });
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, signedIn.id));
    expect(sessions).toEqual([]);
    await expect(
      auth.api.signInEmail({ body: { email: email("forgetful"), password } }),
    ).rejects.toThrow();
    await auth.api.signInEmail({
      body: { email: email("forgetful"), password: "a-brand-new-password" },
    });

    // Tokens work once.
    await expect(
      auth.api.resetPassword({
        body: { token, newPassword: "yet-another-pw" },
      }),
    ).rejects.toThrow();
  });

  it("answers the same for unknown addresses, and sends nothing", async () => {
    const result = await auth.api.requestPasswordReset({
      body: { email: email("nobody"), redirectTo: "/reset-password" },
    });
    expect(result.status).toBe(true);
    await settle();
    expect(sent.filter((m) => m.to === email("nobody"))).toEqual([]);
  });

  it("sends at most three reset emails an hour to one person", async () => {
    // One was already sent above.
    for (let i = 0; i < 4; i++) {
      await auth.api.requestPasswordReset({
        body: { email: email("forgetful"), redirectTo: "/reset-password" },
      });
    }
    await settle();
    expect(
      sent.filter(
        (m) => m.to === email("forgetful") && m.tag === "reset-password",
      ),
    ).toHaveLength(2);
  });
});

describe("invite emails", () => {
  it("emails the same one-time link the admin can copy", async () => {
    const admin = { id: `${P}-admin`, role: "admin" as const };
    await db
      .insert(user)
      .values({ ...admin, name: "Mail Admin", email: email("admin") });
    vi.mocked(getSession).mockResolvedValue({
      user: { ...admin, name: "Mail Admin", email: email("admin") },
    } as never);

    const result = await createInvite({
      email: email("new-editor"),
      role: "editor",
      sendEmail: true,
    });
    if (!result.ok || result.data.kind !== "invite") {
      throw new Error("expected an invite");
    }
    expect(result.data.emailed).toBe(true);
    const message = await nextEmail(email("new-editor"), "invite");
    expect(message.subject).toMatch(/^Mail Admin invited you to .+/);
    expect(message.text).toContain("as an editor");
    expect(linkIn(message).href).toBe(result.data.url);
  });
});
