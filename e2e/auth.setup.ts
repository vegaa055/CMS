import { readFile } from "node:fs/promises";

import { expect, test as setup } from "@playwright/test";

import { E2E } from "./db";

/** Sign in through the real login form once and reuse the session. */
setup("sign in as the e2e admin", async ({ page }) => {
  const { email, password } = JSON.parse(
    await readFile(E2E.credentialsFile, "utf8"),
  );
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: E2E.storageState });
});
