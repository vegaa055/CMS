import { expect, test, type Page } from "@playwright/test";

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Scoped to <main>: during production streaming React briefly keeps a second
 * copy of the page in a hidden container outside it.
 */
const fileInput = (page: Page) =>
  page.getByRole("main").locator('input[type="file"]');

test("upload, describe, and delete an image", async ({ page }) => {
  const name = `e2e-pixel-${Date.now()}.png`;
  await page.goto("/admin/media");
  await fileInput(page).setInputFiles({
    name,
    mimeType: "image/png",
    buffer: PNG,
  });

  const tile = page.getByRole("button", { name });
  await expect(tile).toBeVisible();

  await tile.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(name)).toBeVisible();
  await sheet.getByLabel("Alt text").fill("A single test pixel");
  await sheet.getByRole("button", { name: "Save alt text" }).click();
  await expect(page.getByText("Alt text saved")).toBeVisible();

  await sheet.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete file" }).click();
  await expect(page.getByText("File deleted")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "A single test pixel" }),
  ).toHaveCount(0);
});

test("rejects unsupported file types in the browser", async ({ page }) => {
  await page.goto("/admin/media");
  await fileInput(page).setInputFiles({
    name: "e2e-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByText(/Unsupported type/)).toBeVisible();
});
