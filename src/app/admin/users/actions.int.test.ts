/**
 * Users, invites, profiles, and settings against the real DB.
 * Only touches its own `int-p7-*` rows; existing users are never modified.
 * Run with `npm run test:int`.
 */
import { and, eq, inArray, like, notLike } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { acceptInvite } from "@/app/(auth)/invite/actions";
import { updateProfile } from "@/app/admin/profile/actions";
import { updateSiteSettings } from "@/app/admin/settings/actions";
import { db } from "@/db";
import { account, invitation, settings, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { findValidInvite } from "@/lib/invites";
import { DEFAULT_SITE_SETTINGS, getSiteSettings } from "@/lib/settings";

import {
  changeUserRole,
  createInvite,
  removeUser,
  revokeInvite,
} from "./actions";

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

const P = "int-p7";
const ADMIN = { id: `${P}-admin`, role: "admin" as const };
const ADMIN2 = { id: `${P}-admin2`, role: "admin" as const };
const AUTHOR = { id: `${P}-author`, role: "author" as const };
const email = (name: string) => `${name}@folio.local`;

function actAs(u: { id: string; role: "admin" | "editor" | "author" }) {
  vi.mocked(getSession).mockResolvedValue({
    user: { ...u, name: u.id, email: email(u.id) },
  } as never);
}

const otherAdmins = await db
  .select({ id: user.id })
  .from(user)
  .where(and(eq(user.role, "admin"), notLike(user.email, `${P}%`)));
const onlyTestAdmins = otherAdmins.length === 0;

let savedSettings: (typeof settings.$inferSelect)[] = [];

async function cleanup() {
  await db.delete(invitation).where(like(invitation.email, `${P}%`));
  await db.delete(user).where(like(user.email, `${P}%`));
}

beforeAll(async () => {
  savedSettings = await db
    .select()
    .from(settings)
    .where(like(settings.key, "site.%"));
  await cleanup();
  await db.insert(user).values(
    [ADMIN, ADMIN2, AUTHOR].map((u) => ({
      id: u.id,
      role: u.role,
      name: u.id,
      email: email(u.id),
    })),
  );
});

afterAll(async () => {
  await cleanup();
  // Restore whatever site settings existed before the run.
  await db.delete(settings).where(like(settings.key, "site.%"));
  if (savedSettings.length) await db.insert(settings).values(savedSettings);
});

describe("role management", () => {
  it("is admin-only", async () => {
    actAs(AUTHOR);
    expect((await changeUserRole(ADMIN2.id, "author")).ok).toBe(false);
  });

  it("refuses changing your own role or removing yourself", async () => {
    actAs(ADMIN);
    expect((await changeUserRole(ADMIN.id, "author")).ok).toBe(false);
    expect((await removeUser(ADMIN.id)).ok).toBe(false);
  });

  it("changes roles and rejects unknown ones", async () => {
    actAs(ADMIN);
    expect((await changeUserRole(AUTHOR.id, "superuser")).ok).toBe(false);
    expect(await changeUserRole(AUTHOR.id, "editor")).toEqual({
      ok: true,
      data: { role: "editor" },
    });
    // Another admin exists, so demoting a second admin is allowed.
    expect((await changeUserRole(ADMIN2.id, "author")).ok).toBe(true);
    const rows = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(inArray(user.id, [AUTHOR.id, ADMIN2.id]));
    expect(Object.fromEntries(rows.map((r) => [r.id, r.role]))).toEqual({
      [AUTHOR.id]: "editor",
      [ADMIN2.id]: "author",
    });
  });

  it("removes users", async () => {
    actAs(ADMIN);
    expect((await removeUser(ADMIN2.id)).ok).toBe(true);
    expect(
      await db.query.user.findFirst({ where: eq(user.id, ADMIN2.id) }),
    ).toBeUndefined();
  });

  // Only meaningful when no real admins exist (CI's fresh branch); on a
  // shared dev DB the site's own admin always counts as another admin.
  it.runIf(onlyTestAdmins)(
    "never demotes or removes the last admin",
    async () => {
      // ADMIN2 was removed above, so ADMIN is now the only admin. Act as a
      // session whose user isn't an admin in the DB (e.g. demoted mid-session).
      actAs({ id: `${P}-ghost`, role: "admin" });
      expect(await changeUserRole(ADMIN.id, "author")).toMatchObject({
        ok: false,
        error: expect.stringMatching(/at least one admin/),
      });
      expect(await removeUser(ADMIN.id)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/at least one admin/),
      });
    },
  );
});

describe("invitations", () => {
  let inviteUrl: string;
  const invited = email(`${P}-invitee`);
  const tokenOf = (url: string) => url.split("/invite/")[1]!;

  it("rejects inviting an existing account", async () => {
    actAs(ADMIN);
    expect(
      await createInvite({ email: email(AUTHOR.id), role: "author" }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(String) },
    });
  });

  it("creates a one-time link, storing only a hash", async () => {
    actAs(ADMIN);
    const result = await createInvite({
      email: invited.toUpperCase(),
      role: "editor",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    inviteUrl = result.data.url;
    const token = tokenOf(inviteUrl);
    const row = await findValidInvite(token);
    expect(row).toMatchObject({ email: invited, role: "editor" });
    expect(row!.tokenHash).not.toContain(token);
  });

  it("keeps public sign-up closed without an invite", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: invited, name: "Sneaky", password: "long-enough-pw" },
      }),
    ).rejects.toThrow(/closed/i);
  });

  it("accepts the invite with the invited role, exactly once", async () => {
    const token = tokenOf(inviteUrl);
    await expect(
      acceptInvite(token, {
        name: "Invited Editor",
        password: "long-enough-pw",
      }),
    ).rejects.toThrow(/REDIRECT \/admin/);
    const created = await db.query.user.findFirst({
      where: eq(user.email, invited),
    });
    expect(created).toMatchObject({ name: "Invited Editor", role: "editor" });
    const creds = await db
      .select()
      .from(account)
      .where(eq(account.userId, created!.id));
    expect(creds[0]?.providerId).toBe("credential");

    expect(await findValidInvite(token)).toBeUndefined();
    expect(
      (await acceptInvite(token, { name: "Again", password: "long-enough-pw" }))
        .ok,
    ).toBe(false);
  });

  it("revokes pending invites and rejects garbage tokens", async () => {
    actAs(ADMIN);
    const result = await createInvite({
      email: email(`${P}-revoked`),
      role: "author",
    });
    if (!result.ok) throw new Error(result.error);
    const row = await findValidInvite(tokenOf(result.data.url));
    expect((await revokeInvite(row!.id)).ok).toBe(true);
    expect(await findValidInvite(tokenOf(result.data.url))).toBeUndefined();
    expect(await findValidInvite("not-a-token")).toBeUndefined();
  });
});

describe("profiles", () => {
  it("validates, normalizes, and de-duplicates usernames", async () => {
    actAs(AUTHOR);
    const base = { name: "Int Author", bio: "", image: "" };
    expect((await updateProfile({ ...base, username: "admin" })).ok).toBe(
      false,
    );
    expect((await updateProfile({ ...base, username: "Bad Name!" })).ok).toBe(
      false,
    );
    expect(
      (await updateProfile({ ...base, username: `${P}-writer`.toUpperCase() }))
        .ok,
    ).toBe(true);
    const row = await db.query.user.findFirst({
      where: eq(user.id, AUTHOR.id),
    });
    expect(row?.username).toBe(`${P}-writer`);

    actAs(ADMIN);
    expect(
      await updateProfile({
        ...base,
        name: "Int Admin",
        username: `${P}-writer`,
      }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { username: expect.any(String) },
    });
    expect(
      (
        await updateProfile({
          ...base,
          image: "javascript:alert(1)",
          username: "",
        })
      ).ok,
    ).toBe(false);
  });
});

describe("site settings", () => {
  const valid = {
    ...DEFAULT_SITE_SETTINGS,
    name: "Int Site",
    links: { ...DEFAULT_SITE_SETTINGS.links, x: "https://x.com/example" },
  };

  it("requires settings:manage and valid input", async () => {
    actAs(AUTHOR);
    expect((await updateSiteSettings(valid)).ok).toBe(false);
    actAs(ADMIN);
    expect(
      (
        await updateSiteSettings({
          ...valid,
          links: { ...valid.links, website: "ftp://nope" },
        })
      ).ok,
    ).toBe(false);
  });

  it("saves and reads back, falling back per field on bad data", async () => {
    actAs(ADMIN);
    expect((await updateSiteSettings(valid)).ok).toBe(true);
    expect(await getSiteSettings()).toEqual(valid);

    // A corrupted value only resets that field.
    await db
      .update(settings)
      .set({ value: 42 })
      .where(eq(settings.key, "site.tagline"));
    const read = await getSiteSettings();
    expect(read.tagline).toBe(DEFAULT_SITE_SETTINGS.tagline);
    expect(read.name).toBe("Int Site");
  });
});
