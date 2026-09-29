import { sql } from "../db";
import { linkIn, waitForEmail } from "../emails";
import { expect, test } from "../fixtures";
import { submitWhenReady } from "../forms";
import { randomPassword } from "../passwords";

const SETTING = "readers.signupEnabled";
let original: unknown;

// The test flips the site-wide switch; put back whatever was there.
test.beforeAll(async () => {
  const rows = await sql()`select value from settings where key = ${SETTING}`;
  original = rows[0]?.value;
});

test.afterAll(async () => {
  if (original === undefined) {
    await sql()`delete from settings where key = ${SETTING}`;
  } else {
    await sql()`update settings set value = ${JSON.stringify(original)}::jsonb where key = ${SETTING}`;
  }
});

test("readers sign up, stay out of the dashboard, and can be promoted", async ({
  page,
  browser,
  baseURL,
}) => {
  const stamp = Date.now();
  const name = `E2E Reader ${stamp}`;
  const email = `e2e-reader-${stamp}@folio.local`;

  // Admin opens reader sign-up.
  await page.goto("/admin/settings");
  const toggle = page.getByRole("switch", { name: "Allow reader sign-up" });
  if (!(await toggle.isChecked())) {
    await toggle.click();
    await expect(page.getByText("Reader sign-up is on")).toBeVisible();
  }
  await expect(toggle).toBeChecked();

  // A visitor signs up from a post link and is sent back there.
  const guest = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const reader = await guest.newPage();
  await reader.goto("/register?next=/posts");
  await expect(reader.getByText(/as a reader/)).toBeVisible();
  await reader.getByLabel("Name").fill(name);
  await reader.getByLabel("Email").fill(email);
  const password = randomPassword();
  await reader.getByLabel("Password", { exact: true }).fill(password);
  await reader.getByLabel("Confirm password").fill(password);
  await submitWhenReady(reader.getByRole("button", { name: "Create account" }));
  await expect(reader).toHaveURL(`${baseURL}/posts`);

  // The confirmation email's link verifies them and leads back to /posts.
  const confirmation = await waitForEmail(email, "verify-email", stamp);
  await reader.goto(linkIn(confirmation));
  await expect(
    reader.getByRole("heading", { name: "Email confirmed" }),
  ).toBeVisible();
  await reader.getByRole("link", { name: "Continue" }).click();
  await expect(reader).toHaveURL(`${baseURL}/posts`);

  // The dashboard is off limits, even by asking for it after sign-in.
  await reader.goto("/admin");
  await expect(reader.getByText("only for the team")).toBeVisible();
  await expect(
    reader.getByRole("link", { name: "Back to the site" }),
  ).toBeVisible();
  await reader.goto("/login?next=/admin/users");
  await expect(reader).toHaveURL(`${baseURL}/`);

  // The admin finds them under Readers and makes them an author.
  await page.goto("/admin/users/readers");
  await page.getByRole("searchbox", { name: /Search readers/ }).fill(name);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("table").getByText(email)).toBeVisible();
  await expect(page.getByRole("main").getByText("Unverified")).toHaveCount(0);
  await page.getByRole("combobox", { name: `Role for ${name}` }).click();
  await page.getByRole("option", { name: "Author" }).click();
  await expect(page.getByText(`${name} is now author`)).toBeVisible();

  // The new role applies on their very next request.
  await reader.goto("/admin");
  await expect(
    reader.getByRole("heading", { name: /Hello, E2E/ }),
  ).toBeVisible();
  await guest.close();

  // Closing sign-up again shows the closed notice to visitors.
  await page.goto("/admin/settings");
  await toggle.click();
  await expect(page.getByText("Reader sign-up is off")).toBeVisible();
  const visitor = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const closed = await visitor.newPage();
  await closed.goto("/register");
  await expect(closed.getByText("Registration is closed")).toBeVisible();
  await visitor.close();

  // Clean up: remove them from the team list.
  await page.goto("/admin/users");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Remove user" }).click();
  await page.getByRole("button", { name: "Remove user" }).click();
  await expect(page.getByText(`${name} was removed`)).toBeVisible();
});
