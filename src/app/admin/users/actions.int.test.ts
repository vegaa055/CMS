/**
 * Users, invites, profiles, and settings against the real DB.
 * Only touches its own `int-p7-*` rows; existing users are never modified.
 * Run with `npm run test:int`.
 */
import { and, eq, inArray, like, notLike, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  acceptInvite,
  acceptInviteAsReader,
} from "@/app/(auth)/invite/actions";
import { updateProfile } from "@/app/admin/profile/actions";
import { updateSiteSettings } from "@/app/admin/settings/actions";
import { db } from "@/db";
import { account, invitation, settings, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import type { Role } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import {
  findValidInvite,
  hashInviteToken,
  newInviteToken,
} from "@/lib/invites";
import {
  DEFAULT_SITE_SETTINGS,
  getSiteSettings,
  saveReaderSettings,
} from "@/lib/settings";

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
const READER = { id: `${P}-reader`, role: "reader" as const };
const email = (name: string) => `${name}@folio.local`;

function actAs(u: { id: string; role: Role }) {
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
const sharedSettings = or(
  like(settings.key, "site.%"),
  like(settings.key, "readers.%"),
);

async function cleanup() {
  await db.delete(invitation).where(like(invitation.email, `${P}%`));
  await db.delete(user).where(like(user.email, `${P}%`));
}

beforeAll(async () => {
  savedSettings = await db.select().from(settings).where(sharedSettings);
  await cleanup();
  await db.insert(user).values(
    [ADMIN, ADMIN2, AUTHOR, READER].map((u) => ({
      id: u.id,
      role: u.role,
      name: u.id,
      email: email(u.id),
    })),
  );
});

afterAll(async () => {
  await cleanup();
  // Restore whatever site and reader settings existed before the run.
  await db.delete(settings).where(sharedSettings);
  if (savedSettings.length) await db.insert(settings).values(savedSettings);
});

describe("role management", () => {
  it("is admin-only", async () => {
    actAs(AUTHOR);
    expect((await changeUserRole(ADMIN2.id, "author")).ok).toBe(false);
    actAs(READER);
    expect((await changeUserRole(READER.id, "admin")).ok).toBe(false);
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

  it("moves people between readers and the team", async () => {
    actAs(ADMIN);
    expect((await changeUserRole(READER.id, "author")).ok).toBe(true);
    expect((await changeUserRole(READER.id, "reader")).ok).toBe(true);
    const row = await db.query.user.findFirst({
      where: eq(user.id, READER.id),
    });
    expect(row?.role).toBe("reader");
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
      expect(await changeUserRole(ADMIN.id, "reader")).toMatchObject({
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

  it("rejects inviting someone already on the team", async () => {
    actAs(ADMIN);
    expect(
      await createInvite({ email: email(AUTHOR.id), role: "author" }),
    ).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.any(String) },
    });
  });

  it("offers to promote a reader instead of inviting them", async () => {
    actAs(ADMIN);
    expect(
      await createInvite({ email: email(READER.id), role: "editor" }),
    ).toEqual({
      ok: true,
      data: {
        kind: "existing-reader",
        userId: READER.id,
        name: READER.id,
        role: "editor",
      },
    });
    const rows = await db
      .select()
      .from(invitation)
      .where(eq(invitation.email, email(READER.id)));
    expect(rows).toEqual([]);
  });

  it("only invites team roles", async () => {
    actAs(ADMIN);
    expect(
      (await createInvite({ email: email(`${P}-x`), role: "reader" })).ok,
    ).toBe(false);
  });

  it("creates a one-time link, storing only a hash", async () => {
    actAs(ADMIN);
    const result = await createInvite({
      email: invited.toUpperCase(),
      role: "editor",
    });
    if (!result.ok || result.data.kind !== "invite") {
      throw new Error("expected an invite link");
    }
    inviteUrl = result.data.url;
    const token = tokenOf(inviteUrl);
    const row = await findValidInvite(token);
    expect(row).toMatchObject({ email: invited, role: "editor" });
    expect(row!.tokenHash).not.toContain(token);
  });

  it("keeps public sign-up closed without an invite", async () => {
    await saveReaderSettings({ signupEnabled: false });
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
    if (!result.ok || result.data.kind !== "invite") {
      throw new Error("expected an invite link");
    }
    const row = await findValidInvite(tokenOf(result.data.url));
    expect((await revokeInvite(row!.id)).ok).toBe(true);
    expect(await findValidInvite(tokenOf(result.data.url))).toBeUndefined();
    expect(await findValidInvite("not-a-token")).toBeUndefined();
  });
});

describe("invitations for readers who signed up meanwhile", () => {
  // Invited first, then signed up as a reader before accepting.
  const token = newInviteToken();

  beforeAll(async () => {
    await db.insert(invitation).values({
      id: crypto.randomUUID(),
      email: email(READER.id),
      role: "author",
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  });

  it("won't create a second account for the same email", async () => {
    expect(
      await acceptInvite(token, { name: "Dup", password: "long-enough-pw" }),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already have an account/),
    });
    expect(await findValidInvite(token)).toBeDefined();
  });

  it("only lets the invited reader accept in place", async () => {
    actAs(AUTHOR); // different email
    expect((await acceptInviteAsReader(token)).ok).toBe(false);
    actAs(READER);
    await expect(acceptInviteAsReader(token)).rejects.toThrow(
      /REDIRECT \/admin/,
    );
    const row = await db.query.user.findFirst({
      where: eq(user.id, READER.id),
    });
    expect(row?.role).toBe("author");
    expect(await findValidInvite(token)).toBeUndefined();
  });
});

describe("profiles", () => {
  const base = { name: "Int Author", bio: "", image: "" };

  it("validates, normalizes, and de-duplicates usernames", async () => {
    actAs(AUTHOR);
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

  it("gives readers no author profile (no public page to claim)", async () => {
    const reader = { id: `${P}-reader2`, role: "reader" as const };
    await db
      .insert(user)
      .values({ ...reader, name: "R", email: email(reader.id) });
    actAs(reader);
    expect(
      await updateProfile({ ...base, username: `${P}-squatter`, bio: "Hi" }),
    ).toMatchObject({ ok: false });
    const row = await db.query.user.findFirst({
      where: eq(user.id, reader.id),
    });
    expect(row).toMatchObject({ username: null, bio: null });
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
