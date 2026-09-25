import { expect, test } from "@playwright/test";

test("write, publish, view, and delete a post", async ({ page }) => {
  const stamp = Date.now();
  const title = `E2E Post ${stamp}`;
  const slug = `e2e-post-${stamp}`;

  await page.goto("/admin/posts/new");
  await page.getByLabel("Title", { exact: true }).fill(title);
  // Slug follows the title.
  await expect(page.getByLabel("URL slug")).toHaveValue(slug);

  const body = page.getByLabel("Post content");
  await body.click();
  await page.keyboard.type("Section heading");
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Body text written by Playwright.");

  // Draft autosaves and the URL switches to the new post's id.
  await expect(
    page.getByRole("status").filter({ hasText: /Saved/ }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}$/);

  // Create a brand-new tag inline.
  await page.getByRole("button", { name: "Add tag" }).click();
  await page.getByPlaceholder("Find or create…").fill(`e2e tag ${stamp}`);
  await page
    .getByRole("option", { name: new RegExp(`Create .e2e tag ${stamp}`) })
    .click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(
    page.getByText("Published", { exact: true }).first(),
  ).toBeVisible();

  // Reloaded editor shows the real word count (regression: it showed 0).
  await page.reload();
  await expect(page.getByText(/^\d+ words? · \d+ min read$/)).toHaveText(
    /^[1-9]/,
  );

  // The public page renders the heading (attrs survived the server action).
  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(
    page.getByRole("heading", { level: 2, name: "Section heading" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `e2e tag ${stamp}` }),
  ).toBeVisible();

  // Delete from the editor, then it's gone from the site.
  await page.goto("/admin/posts");
  await page.getByRole("link", { name: title }).click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete post" }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  expect((await page.goto(`/posts/${slug}`))?.status()).toBe(404);
});
