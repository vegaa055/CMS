import { describe, expect, it } from "vitest";

import {
  can,
  canDeletePost,
  canEditPost,
  canManageMedia,
  canPreviewPost,
  isRole,
  isStaff,
  PERMISSION_NAMES,
  ROLE_LABELS,
  ROLES,
  STAFF_ROLES,
} from "./permissions";

const admin = { id: "a", role: "admin" as const };
const editor = { id: "e", role: "editor" as const };
const author = { id: "w", role: "author" as const };

describe("can", () => {
  it("restricts publishing and administration", () => {
    expect(can("author", "post:publish")).toBe(false);
    expect(can("editor", "post:publish")).toBe(true);
    expect(can("editor", "user:manage")).toBe(false);
    expect(can("admin", "settings:manage")).toBe(true);
    expect(can(null, "dashboard:view")).toBe(false);
  });
});

describe("post ownership rules", () => {
  const ownDraft = { authorId: "w", status: "draft" };
  const ownLive = { authorId: "w", status: "published" };
  const othersDraft = { authorId: "someone-else", status: "draft" };

  it("lets authors edit and delete only their own drafts", () => {
    expect(canEditPost(author, ownDraft)).toBe(true);
    expect(canDeletePost(author, ownDraft)).toBe(true);
    expect(canEditPost(author, ownLive)).toBe(false);
    expect(canDeletePost(author, ownLive)).toBe(false);
    expect(canEditPost(author, othersDraft)).toBe(false);
  });

  it("lets authors preview their own posts in any status", () => {
    expect(canPreviewPost(author, ownLive)).toBe(true);
    expect(canPreviewPost(author, othersDraft)).toBe(false);
  });

  it("lets editors and admins manage any post", () => {
    for (const user of [editor, admin]) {
      expect(canEditPost(user, othersDraft)).toBe(true);
      expect(canEditPost(user, ownLive)).toBe(true);
      expect(canDeletePost(user, ownLive)).toBe(true);
    }
  });
});

describe("readers", () => {
  const reader = { id: "r", role: "reader" as const };

  it("hold no dashboard permission at all", () => {
    for (const permission of PERMISSION_NAMES) {
      expect(can("reader", permission)).toBe(false);
    }
  });

  it("are the only role that isn't staff", () => {
    expect(isStaff("reader")).toBe(false);
    expect(isStaff(null)).toBe(false);
    for (const role of STAFF_ROLES) expect(isStaff(role)).toBe(true);
    expect(ROLES.filter((r) => !isStaff(r))).toEqual(["reader"]);
  });

  it("can't touch posts or media, even ones attributed to them", () => {
    const own = { authorId: "r", status: "draft" };
    expect(canEditPost(reader, own)).toBe(false);
    expect(canDeletePost(reader, own)).toBe(false);
    expect(canPreviewPost(reader, own)).toBe(false);
    expect(canManageMedia(reader, { uploadedById: "r" })).toBe(false);
  });

  it("is a known role with a label", () => {
    expect(isRole("reader")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    for (const role of ROLES) expect(ROLE_LABELS[role]).toBeTruthy();
  });
});
