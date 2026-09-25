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

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  author: "Author",
};
