import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { Role } from "./permissions";

/**
 * Set by `acceptInvite` around its in-process sign-up call, so the auth
 * sign-up hook can admit an invited user (with the invited role) even when
 * public registration is closed. Nothing outside that call can set it.
 */
export const inviteContext = new AsyncLocalStorage<{
  email: string;
  role: Role;
}>();
