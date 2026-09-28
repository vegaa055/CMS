import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import { sql } from "./db";
import { randomPassword } from "./passwords";

/**
 * Liking a post: the signed-out prompt, signing in and coming back, the
 * like surviving a reload, and removing it from Account → Liked stories.
 */
const stamp = Date.now();
const slug = `e2e-like-${stamp}`;
const title = `E2E Likeable ${stamp}`;
const readerId = `e2e-liker-${stamp}`;
const email = `${readerId}@folio.local`;
const password = randomPassword();

// Our own post and reader; the e2e teardown removes both (and the like).
test.beforeAll(async () => {
  const db = sql();
  await db`insert into posts (title, slug, content, content_text, status, published_at)
    values (${title}, ${slug}, ${JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Worth a like." }] }] })}::jsonb,
      'Worth a like.', 'published', now() - interval '1 hour')`;
  await db`insert into "user" (id, name, email, email_verified, role)
    values (${readerId}, 'E2E Liker', ${email}, true, 'reader')`;
  await db`insert into account (id, account_id, provider_id, user_id, password)
    values (${`${readerId}-credential`}, ${readerId}, 'credential', ${readerId}, ${await hashPassword(password)})`;
});

test("readers like posts and find them under Liked stories", async ({
  page,
  baseURL,
}) => {
  const postUrl = `${baseURL}/posts/${slug}`;
  await page.goto(`/posts/${slug}`);

  // Signed out: the heart invites you to sign in and brings you back.
  await page
    .getByRole("button", { name: /^Like this post \(0 likes\)/ })
    .click();
  const prompt = page.getByRole("dialog");
  await expect(prompt.getByText("Sign in to like this post")).toBeVisible();
  await prompt.getByRole("link", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(postUrl);

  // Like it; it survives a reload.
  await page
    .getByRole("button", { name: /^Like this post \(0 likes\)/ })
    .click();
  const unlike = page.getByRole("button", {
    name: /^Unlike this post \(1 like\)/,
  });
  await expect(unlike).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(unlike).toBeVisible();

  // It's listed under Account → Liked stories, where it can be removed.
  await page
    .getByRole("banner")
    .getByRole("button", { name: "Account menu" })
    .click();
  await page.getByRole("menuitem", { name: "Liked stories" }).click();
  await expect(page).toHaveURL(`${baseURL}/account/likes`);
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: title })).toBeVisible();
  await main.getByRole("button", { name: `Unlike “${title}”` }).click();
  await expect(page.getByText("Removed from your liked stories")).toBeVisible();
  await expect(main.getByText("No liked stories yet")).toBeVisible();

  await page.goto(`/posts/${slug}`);
  await expect(
    page.getByRole("button", { name: /^Like this post \(0 likes\)/ }),
  ).toBeVisible();
});
