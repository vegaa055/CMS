import { expect, test } from "@playwright/test";

import { E2E } from "../db";

test("invite a user, who signs up and is then removed", async ({
  page,
  browser,
}) => {
  const email = `e2e-invitee-${Date.now()}@folio.local`;

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Invite user" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create invite" }).click();
  const link = await page
    .locator('input[readonly][value*="/invite/"]')
    .inputValue();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(email)).toBeVisible(); // pending invites list

  // Accept in a separate, signed-out browser.
  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const invitee = await guest.newPage();
  await invitee.goto(link);
  await expect(invitee.getByLabel("Email")).toHaveValue(email);
  await invitee.getByLabel("Name").fill("E2E Invitee");
  await invitee
    .getByLabel("Password", { exact: true })
    .fill("e2e-invitee-password");
  await invitee.getByLabel("Confirm password").fill("e2e-invitee-password");
  await invitee.getByRole("button", { name: "Create account" }).click();
  await expect(invitee).toHaveURL(/\/admin$/);

  // The link only works once.
  await invitee.goto(link);
  await expect(
    invitee.getByText(/invitation isn.t valid|already signed in/),
  ).toBeVisible();
  await guest.close();

  // Remove them again.
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Actions for E2E Invitee" }).click();
  await page.getByRole("menuitem", { name: "Remove user" }).click();
  await page.getByRole("button", { name: "Remove user" }).click();
  await expect(page.getByText("E2E Invitee was removed")).toBeVisible();
});

test("admins can't change their own role", async ({ page }) => {
  await page.goto("/admin/users");
  // Your own row shows a static badge instead of a role picker.
  await expect(
    page.getByRole("combobox", { name: `Role for ${E2E.name}` }),
  ).toHaveCount(0);
});
