import { expect, test } from "@playwright/test";

/**
 * Regenerates README screenshots: `npm run screenshots`.
 * Uses whatever content is in the database you point it at.
 */
const out = (name: string) => `docs/screenshots/${name}.png`;

test("capture screenshots", async ({ page }) => {
  // Hide the Next.js dev-mode indicator if running against `next dev`.
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.append(style),
    );
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: out("home") });

  await page.locator("article h2 a, article h3 a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({ path: out("post") });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /Hello/ })).toBeVisible();
  await page.screenshot({ path: out("dashboard") });

  await page.goto("/admin/posts");
  await page.locator("table tbody tr a").first().click();
  await expect(page.getByLabel("Post content")).toBeVisible();
  await page.screenshot({ path: out("editor") });

  await page.goto("/admin/media");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: out("media") });

  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: out("home-light") });
});
