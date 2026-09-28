import { expect, test, type Page } from "@playwright/test";

import { sql } from "./db";
import { linkIn, waitForEmail } from "./emails";
import { submitWhenReady } from "./forms";
import { randomPassword } from "./passwords";

/**
 * A reader's whole journey: sign up, confirm the email, manage the account,
 * sign out, reset a forgotten password, and delete the account.
 */
const SETTING = "readers.signupEnabled";
let original: unknown;

// Sign-up must be open; put back whatever was there afterwards.
test.beforeAll(async () => {
  const rows = await sql()`select value from settings where key = ${SETTING}`;
  original = rows[0]?.value;
  await sql()`insert into settings (key, value) values (${SETTING}, 'true'::jsonb)
    on conflict (key) do update set value = 'true'::jsonb`;
});

test.afterAll(async () => {
  if (original === undefined) {
    await sql()`delete from settings where key = ${SETTING}`;
  } else {
    await sql()`update settings set value = ${JSON.stringify(original)}::jsonb where key = ${SETTING}`;
  }
});

const header = (page: Page) => page.getByRole("banner");

async function openAccountMenu(page: Page) {
  await header(page).getByRole("button", { name: "Account menu" }).click();
}

test("a reader signs up, manages their account, and deletes it", async ({
  page,
  baseURL,
}) => {
  const stamp = Date.now();
  const email = `e2e-journey-${stamp}@folio.local`;
  let password = randomPassword();

  // From a public page, "Sign in" → "Create one", keeping the way back.
  await page.goto("/posts");
  await header(page).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fposts$/);
  await page.getByRole("link", { name: "Create one" }).click();
  await expect(page.getByText(/as a reader/)).toBeVisible();

  // Passwords from known breaches are refused.
  await page.getByLabel("Name").fill("Journey Reader");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("password1234");
  await page.getByLabel("Confirm password").fill("password1234");
  await submitWhenReady(page.getByRole("button", { name: "Create account" }));
  await expect(
    page.getByText(/appeared in a data breach/).first(),
  ).toBeVisible();

  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await submitWhenReady(page.getByRole("button", { name: "Create account" }));
  await expect(page).toHaveURL(`${baseURL}/posts`);
  await expect(
    header(page).getByRole("button", { name: "Account menu" }),
  ).toBeVisible();

  // Confirm the email from the inbox.
  const confirmation = await waitForEmail(email, "verify-email", stamp);
  await page.goto(linkIn(confirmation));
  await expect(
    page.getByRole("heading", { name: "Email confirmed" }),
  ).toBeVisible();

  // The account page, from the header menu.
  await page.goto("/posts");
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Account" }).click();
  await expect(
    page.getByRole("heading", { name: "Your account" }),
  ).toBeVisible();
  const main = page.getByRole("main");
  await expect(main.getByText("Confirmed", { exact: true })).toBeVisible();
  await main.getByLabel("Display name").fill("Journey Renamed");
  await main.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Name saved")).toBeVisible();

  // Sign out from the header; account pages send you home.
  await openAccountMenu(page);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(
    header(page).getByRole("link", { name: "Sign in" }),
  ).toBeVisible();

  // Forgot the password: reset it by email.
  const resetStart = Date.now();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await submitWhenReady(page.getByRole("button", { name: "Send reset link" }));
  await expect(page.getByText("Check your email")).toBeVisible();
  const reset = await waitForEmail(email, "reset-password", resetStart);
  await page.goto(linkIn(reset));
  password = randomPassword();
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText("Password updated")).toBeVisible();

  // Sign back in; readers land on the home page.
  await page.goto("/login?next=/account");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseURL}/account`);
  await expect(main.getByText("Journey Renamed").first()).toBeVisible();

  // Delete the account (password required).
  await main.getByRole("button", { name: "Delete account" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Password").fill("not-my-password");
  await dialog.getByRole("button", { name: "Delete my account" }).click();
  await expect(dialog.getByText("That password is incorrect.")).toBeVisible();
  await dialog.getByLabel("Password").fill(password);
  await dialog.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText("Your account was deleted")).toBeVisible();
  await expect(page).toHaveURL(`${baseURL}/`);

  // It's really gone.
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
});
