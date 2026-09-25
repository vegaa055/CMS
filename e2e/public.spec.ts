import { expect, test } from "@playwright/test";

test.describe("public site", () => {
  test("home links through to the archive and a post", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Writing" })
      .click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(
      page.getByRole("heading", { name: "Writing", level: 1 }),
    ).toBeVisible();

    const firstPost = page.locator("article h3 a").first();
    const title = await firstPost.innerText();
    await firstPost.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });

  test("search highlights matches", async ({ page }) => {
    await page.goto("/search");
    // Snippets come from body text, so search for words in a seeded body.
    await page.getByLabel("Search posts").fill("perceptually uniform");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=perceptually/);
    await expect(
      page.getByText(/result(s)? for “perceptually uniform”/),
    ).toBeVisible();
    await expect(page.locator("mark").first()).toBeVisible();
  });

  test("unknown pages 404", async ({ page }) => {
    const res = await page.goto("/posts/definitely-not-a-post");
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });

  test("feed, sitemap, and robots are served", async ({ request }) => {
    const feed = await request.get("/feed.xml");
    expect(feed.ok()).toBe(true);
    expect(feed.headers()["content-type"]).toContain("application/rss+xml");
    expect(await feed.text()).toContain("<rss");

    const sitemap = await request.get("/sitemap.xml");
    expect(await sitemap.text()).toContain("<urlset");

    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /admin");
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });
});

test.describe("auth", () => {
  test("the dashboard requires signing in", async ({ page }) => {
    await page.goto("/admin/posts");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fposts/);
  });

  test("wrong passwords are rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("e2e-admin@folio.local");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });
});
