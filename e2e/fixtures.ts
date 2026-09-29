import { test as base } from "@playwright/test";

import { sql } from "./db";

export { expect } from "@playwright/test";

/**
 * The suite signs in and up many times from one address. Production builds
 * (CI runs `next start`) enforce Better Auth's per-IP limits, which would trip
 * across tests, so each test starts with them cleared. The app's own
 * per-person limits (`app:*` keys) are left alone.
 */
export const test = base.extend<{ freshAuthLimits: void }>({
  freshAuthLimits: [
    async ({}, use) => {
      await sql()`delete from rate_limit where key not like 'app:%'`;
      await use();
    },
    { auto: true },
  ],
});
