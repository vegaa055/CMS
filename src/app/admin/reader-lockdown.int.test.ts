/**
 * Readers are signed in but must not be able to do anything in the
 * dashboard. Calls every exported admin server action as a reader, with
 * input that would be valid for staff, and checks nothing changed.
 *
 * New admin actions fail the coverage test until they get a case here.
 * Run with `npm run test:int`.
 */
import { eq, inArray, like, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import * as mediaActions from "@/app/admin/media/actions";
import * as postActions from "@/app/admin/posts/actions";
import * as profileActions from "@/app/admin/profile/actions";
import * as settingsActions from "@/app/admin/settings/actions";
import * as tagActions from "@/app/admin/tags/actions";
import * as userActions from "@/app/admin/users/actions";
import { db } from "@/db";
import { invitation, media, posts, settings, tags, user } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { hashInviteToken, newInviteToken } from "@/lib/invites";
import { DEFAULT_SITE_SETTINGS } from "@/lib/settings";

// Media actions must never reach real storage from a test.
const originalDriver = vi.hoisted(() => {
  const value = process.env.STORAGE_DRIVER;
  process.env.STORAGE_DRIVER = "local";
  return value;
});

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

const P = "int-p9";
const STAFF = { id: `${P}-staff`, role: "author" as const };
const READER = { id: `${P}-reader`, role: "reader" as const };
const email = (id: string) => `${id}@folio.local`;

const modules = {
  media: mediaActions,
  posts: postActions,
  profile: profileActions,
  settings: settingsActions,
  tags: tagActions,
  users: userActions,
};

/** Exports readers may call: they only affect the caller's own account. */
const READER_ALLOWED = new Set(["profile.changePassword"]);

const ids = {
  post: crypto.randomUUID(),
  media: crypto.randomUUID(),
  tag: crypto.randomUUID(),
  invite: crypto.randomUUID(),
};
const mediaKey = `media/2000/01/${ids.media}.png`;
const postInput = {
  title: "Hijacked",
  slug: "",
  excerpt: "",
  tags: [],
  seoTitle: "",
  seoDescription: "",
  status: "draft",
  content: { type: "doc" },
};

/** One or more calls per action, each with staff-valid input. */
const attempts: Record<string, () => Promise<{ ok: boolean }>> = {
  "media.requestUpload": () =>
    mediaActions.requestUpload({
      filename: "x.png",
      contentType: "image/png",
      size: 10,
    }),
  "media.completeUpload": () =>
    mediaActions.completeUpload({
      key: mediaKey,
      filename: "x.png",
      contentType: "image/png",
    }),
  "media.updateMediaAlt": () =>
    mediaActions.updateMediaAlt(ids.media, "hijacked"),
  "media.mediaUsage": () => mediaActions.mediaUsage(ids.media),
  "media.deleteMedia": () => mediaActions.deleteMedia(ids.media),
  "posts.savePost (new)": () => postActions.savePost(postInput),
  "posts.savePost (edit)": () =>
    postActions.savePost({ ...postInput, id: ids.post }),
  "posts.deletePost": () => postActions.deletePost(ids.post),
  "profile.updateProfile": () =>
    profileActions.updateProfile({
      name: "Squatter",
      username: `${P}-squatter`,
      bio: "Visit my shop",
      image: "",
    }),
  "settings.updateSiteSettings": () =>
    settingsActions.updateSiteSettings({
      ...DEFAULT_SITE_SETTINGS,
      name: "Hijacked",
    }),
  "settings.updateReaderSettings": () =>
    settingsActions.updateReaderSettings({ signupEnabled: true }),
  "tags.createTag": () => tagActions.createTag({ name: `${P} new`, slug: "" }),
  "tags.updateTag": () =>
    tagActions.updateTag(ids.tag, { name: "Hijacked", slug: "" }),
  "tags.deleteTag": () => tagActions.deleteTag(ids.tag),
  "users.changeUserRole (self)": () =>
    userActions.changeUserRole(READER.id, "admin"),
  "users.changeUserRole (other)": () =>
    userActions.changeUserRole(STAFF.id, "reader"),
  "users.removeUser": () => userActions.removeUser(STAFF.id),
  "users.createInvite": () =>
    userActions.createInvite({ email: email(`${P}-new`), role: "admin" }),
  "users.revokeInvite": () => userActions.revokeInvite(ids.invite),
};

const sharedSettings = or(
  like(settings.key, "site.%"),
  like(settings.key, "readers.%"),
);
let settingsBefore: (typeof settings.$inferSelect)[] = [];

async function cleanup() {
  await db.delete(invitation).where(like(invitation.email, `${P}-%`));
  await db.delete(posts).where(like(posts.slug, `${P}-%`));
  await db.delete(media).where(eq(media.id, ids.media));
  await db.delete(tags).where(like(tags.slug, `${P}-%`));
  await db.delete(user).where(like(user.email, `${P}-%`));
}

beforeAll(async () => {
  await cleanup();
  settingsBefore = await db
    .select()
    .from(settings)
    .where(sharedSettings)
    .orderBy(settings.key);
  await db
    .insert(user)
    .values(
      [STAFF, READER].map((u) => ({ ...u, name: u.id, email: email(u.id) })),
    );
  await db.batch([
    db.insert(posts).values({
      id: ids.post,
      title: "Int P9 Post",
      slug: `${P}-post`,
      status: "draft",
      authorId: STAFF.id,
    }),
    db.insert(media).values({
      id: ids.media,
      key: mediaKey,
      url: `/uploads/${mediaKey}`,
      filename: "x.png",
      mimeType: "image/png",
      size: 1,
      uploadedById: STAFF.id,
    }),
    db.insert(tags).values({ id: ids.tag, name: `${P} tag`, slug: `${P}-tag` }),
    db.insert(invitation).values({
      id: ids.invite,
      email: email(`${P}-invitee`),
      role: "author",
      tokenHash: hashInviteToken(newInviteToken()),
      expiresAt: new Date(Date.now() + 86_400_000),
    }),
  ]);
  vi.mocked(getSession).mockResolvedValue({
    user: { ...READER, name: "Reader", email: email(READER.id) },
  } as never);
});

afterAll(async () => {
  await cleanup();
  process.env.STORAGE_DRIVER = originalDriver;
});

describe("a signed-in reader", () => {
  it("has a case for every exported admin action", () => {
    const exported = Object.entries(modules).flatMap(([name, mod]) =>
      Object.entries(mod)
        .filter(([, value]) => typeof value === "function")
        .map(([fn]) => `${name}.${fn}`),
    );
    const covered = new Set(Object.keys(attempts).map((k) => k.split(" ")[0]));
    const missing = exported.filter(
      (fn) => !covered.has(fn) && !READER_ALLOWED.has(fn),
    );
    expect(missing, "add a reader case for each new admin action").toEqual([]);
  });

  it.each(Object.keys(attempts))("is refused by %s", async (name) => {
    expect((await attempts[name]!()).ok).toBe(false);
  });

  it("changed nothing", async () => {
    const [post] = await db.select().from(posts).where(eq(posts.id, ids.post));
    expect(post).toMatchObject({ title: "Int P9 Post", status: "draft" });
    const [file] = await db.select().from(media).where(eq(media.id, ids.media));
    expect(file).toMatchObject({ alt: null });
    const tagRows = await db
      .select({ name: tags.name })
      .from(tags)
      .where(like(tags.slug, `${P}-%`));
    expect(tagRows).toEqual([{ name: `${P} tag` }]);

    const people = await db
      .select({ id: user.id, role: user.role, username: user.username })
      .from(user)
      .where(inArray(user.id, [STAFF.id, READER.id]));
    expect(people).toHaveLength(2);
    expect(Object.fromEntries(people.map((p) => [p.id, p.role]))).toEqual({
      [STAFF.id]: "author",
      [READER.id]: "reader",
    });
    expect(people.every((p) => p.username === null)).toBe(true);

    const invites = await db
      .select({ id: invitation.id })
      .from(invitation)
      .where(like(invitation.email, `${P}-%`));
    expect(invites).toEqual([{ id: ids.invite }]);

    const settingsAfter = await db
      .select()
      .from(settings)
      .where(sharedSettings)
      .orderBy(settings.key);
    expect(settingsAfter).toEqual(settingsBefore);
  });
});
