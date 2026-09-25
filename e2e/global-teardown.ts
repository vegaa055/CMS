import { rm } from "node:fs/promises";

import { cleanupE2E } from "./db";

export default async function globalTeardown() {
  await cleanupE2E();
  await rm("e2e/.auth", { recursive: true, force: true });
}
