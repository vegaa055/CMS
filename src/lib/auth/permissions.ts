/**
 * Role-based permissions. Shared by server (enforcement) and client (hiding UI).
 * The client check is cosmetic only; every mutation must re-check on the server.
 */

export const ROLES = ["admin", "editor", "author"] as const;
export type Role = (typeof ROLES)[number];

const PERMISSIONS = {
  "dashboard:view": ["admin", "editor", "author"],
  "post:create": ["admin", "editor", "author"],
  "post:update:own": ["admin", "editor", "author"],
  "post:update:any": ["admin", "editor"],
  "post:publish": ["admin", "editor"],
  "post:delete:own": ["admin", "editor", "author"],
  "post:delete:any": ["admin", "editor"],
  "tag:manage": ["admin", "editor"],
  "media:upload": ["admin", "editor", "author"],
  "media:delete:any": ["admin", "editor"],
  "user:manage": ["admin"],
  "settings:manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

export function can(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/**
 * Ownership-aware check, e.g. `canOnResource(role, "post:update", userId, post.authorId)`
 * passes if the user may update any post, or owns this one and may update their own.
 */
export function canOnResource(
  role: Role | null | undefined,
  action: "post:update" | "post:delete",
  userId: string,
  ownerId: string | null,
) {
  if (can(role, `${action}:any`)) return true;
  return ownerId === userId && can(role, `${action}:own`);
}

type Actor = { id: string; role: Role };
type PostRef = { authorId: string | null; status: string };

/**
 * Authors may only touch their own drafts; once a post is scheduled or live,
 * only roles that can publish may change or delete it.
 */
export function canEditPost(user: Actor, post: PostRef) {
  if (!canOnResource(user.role, "post:update", user.id, post.authorId)) {
    return false;
  }
  return can(user.role, "post:publish") || post.status === "draft";
}

export function canDeletePost(user: Actor, post: PostRef) {
  if (!canOnResource(user.role, "post:delete", user.id, post.authorId)) {
    return false;
  }
  return can(user.role, "post:publish") || post.status === "draft";
}

/** Anyone who could edit the post, or who can edit any post, can preview it. */
export function canPreviewPost(user: Actor, post: PostRef) {
  return canOnResource(user.role, "post:update", user.id, post.authorId);
}

/** Uploaders manage their own media; editors and admins manage all of it. */
export function canManageMedia(
  user: Actor,
  media: { uploadedById: string | null },
) {
  return (
    can(user.role, "media:delete:any") ||
    (media.uploadedById === user.id && can(user.role, "media:upload"))
  );
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  author: "Author",
};
