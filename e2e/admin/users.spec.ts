import { E2E } from "../db";
import { linkIn, waitForEmail } from "../emails";
import { expect, test } from "../fixtures";
import { randomPassword } from "../passwords";

test("invite a user, who signs up and is then removed", async ({
  page,
  browser,
}) => {
  const start = Date.now();
  const email = `e2e-invitee-${start}@folio.local`;

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Invite user" }).click();
  // Exact: the "Email the link to them" switch also mentions email.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Create invite" }).click();
  const link = await page
    .locator('input[readonly][value*="/invite/"]')
    .inputValue();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(email)).toBeVisible(); // pending invites list

  // "Email the link" is on by default: the email carries the same link.
  const invite = await waitForEmail(email, "invite", start);
  expect(linkIn(invite)).toBe(link);

  // Accept in a separate, signed-out browser.
  const guest = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const invitee = await guest.newPage();
  await invitee.goto(link);
  await expect(invitee.getByLabel("Email")).toHaveValue(email);
  await invitee.getByLabel("Name").fill("E2E Invitee");
  const password = randomPassword();
  await invitee.getByLabel("Password", { exact: true }).fill(password);
  await invitee.getByLabel("Confirm password").fill(password);
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
