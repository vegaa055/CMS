import { hashPassword } from "better-auth/crypto";

import { sql } from "../db";
import { expect, test } from "../fixtures";
import { randomPassword } from "../passwords";

/**
 * Comments end to end: a reader signs in from a post and comments, a
 * moderator approves it and replies from the post, and the reader edits,
 * posts again (straight through now), deletes, and finds their comments
 * under Account → Comments.
 */
const stamp = Date.now();
const slug = `e2e-comments-${stamp}`;
const title = `E2E Discussion ${stamp}`;
const readerId = `e2e-commenter-${stamp}`;
const readerName = `E2E Commenter ${stamp}`;
const email = `${readerId}@folio.local`;
const password = randomPassword();

const SETTINGS = ["comments.enabled", "comments.moderation"];
let original: { key: string; value: unknown }[] = [];

// Our own post and reader (the e2e teardown removes both, and the comments
// with the post); comments are switched on for the run and put back after.
test.beforeAll(async () => {
  const db = sql();
  original =
    (await db`select key, value from settings where key = any(${SETTINGS})`) as typeof original;
  await db`insert into settings (key, value)
    values ('comments.enabled', 'true'::jsonb), ('comments.moderation', '"first"'::jsonb)
    on conflict (key) do update set value = excluded.value`;
  await db`insert into posts (title, slug, content, content_text, status, published_at)
    values (${title}, ${slug}, ${JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Tell me what you think." }] }] })}::jsonb,
      'Tell me what you think.', 'published', now() - interval '1 hour')`;
  await db`insert into "user" (id, name, email, email_verified, role)
    values (${readerId}, ${readerName}, ${email}, true, 'reader')`;
  await db`insert into account (id, account_id, provider_id, user_id, password)
    values (${`${readerId}-credential`}, ${readerId}, 'credential', ${readerId}, ${await hashPassword(password)})`;
});

test.afterAll(async () => {
  const db = sql();
  await db`delete from settings where key = any(${SETTINGS})`;
  for (const { key, value } of original) {
    await db`insert into settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)`;
  }
});

test("readers comment, moderators approve and reply", async ({
  page,
  browser,
  baseURL,
}) => {
  const postUrl = `${baseURL}/posts/${slug}`;
  const section = (p: typeof page) =>
    p.getByRole("region", { name: /^(Comments|\d+ comments?)$/ });

  // A signed-out visitor is asked to sign in, and comes back to the post.
  const guest = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const reader = await guest.newPage();
  await reader.goto(`/posts/${slug}`);
  await section(reader)
    .getByRole("link", { name: "Sign in to comment" })
    .click();
  await expect(
    reader.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await reader.getByLabel("Email").fill(email);
  await reader.getByLabel("Password").fill(password);
  await reader.getByRole("button", { name: "Sign in" }).click();
  await expect(reader).toHaveURL(postUrl);

  // Their first comment waits for a moderator; only they can see it.
  const comments = section(reader);
  await expect(
    comments.getByText("A moderator will review your comment"),
  ).toBeVisible();
  await comments
    .getByRole("textbox", { name: "Add a comment" })
    .fill(`First thoughts ${stamp}`);
  await comments.getByRole("button", { name: "Post comment" }).click();
  await expect(
    reader.getByText(/appear once a moderator approves/),
  ).toBeVisible();
  const first = comments
    .getByRole("article", { name: `Comment by ${readerName}` })
    .filter({ hasText: `First thoughts ${stamp}` });
  await expect(first.getByText("Awaiting approval")).toBeVisible();

  // A moderator sees it in the queue (and the sidebar) and approves it.
  await page.goto("/admin/comments");
  await expect(
    page.getByRole("link", { name: /^Comments \(\d+ awaiting approval\)$/ }),
  ).toBeVisible();
  const queued = page
    .getByRole("main")
    .getByRole("listitem", { name: `Comment by ${readerName}` });
  await expect(queued.getByText(title)).toBeVisible();
  await queued.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Comment approved")).toBeVisible();
  await expect(queued).toHaveCount(0);

  // Now it's public; the moderator replies from the post.
  await page.goto(`/posts/${slug}`);
  const onPost = section(page);
  await expect(
    onPost.getByRole("heading", { name: "1 comment" }),
  ).toBeVisible();
  await onPost
    .getByRole("article", { name: `Comment by ${readerName}` })
    .getByRole("button", { name: "Reply" })
    .click();
  await onPost
    .getByRole("textbox", { name: `Reply to ${readerName}` })
    .fill(`Thanks for reading ${stamp}`);
  await onPost.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Reply posted")).toBeVisible();
  const reply = onPost.getByRole("article").filter({
    hasText: `Thanks for reading ${stamp}`,
  });
  await expect(reply.getByText("Team")).toBeVisible();

  // The reader sees it all; their next comment publishes straight away.
  await reader.reload();
  await expect(first.getByText("Awaiting approval")).toHaveCount(0);
  await expect(comments.getByText(`Thanks for reading ${stamp}`)).toBeVisible();
  await expect(
    comments.getByText("A moderator will review your comment"),
  ).toHaveCount(0);
  await comments
    .getByRole("textbox", { name: "Add a comment" })
    .fill(`Second thoughts ${stamp}`);
  await comments.getByRole("button", { name: "Post comment" }).click();
  await expect(reader.getByText("Comment posted")).toBeVisible();
  await expect(
    comments.getByRole("heading", { name: "3 comments" }),
  ).toBeVisible();

  // They fix a typo in it...
  const second = comments
    .getByRole("article", { name: `Comment by ${readerName}` })
    .filter({ hasText: `Second thoughts ${stamp}` });
  await second.getByRole("button", { name: "Edit" }).click();
  await comments
    .getByRole("textbox", { name: "Edit your comment" })
    .fill(`Second thoughts, edited ${stamp}`);
  await comments.getByRole("button", { name: "Save" }).click();
  await expect(reader.getByText("Comment updated")).toBeVisible();
  const edited = comments
    .getByRole("article")
    .filter({ hasText: `Second thoughts, edited ${stamp}` });
  await expect(edited.getByText("· edited")).toBeVisible();

  // ...and delete the first one; the reply keeps its place.
  await first.getByRole("button", { name: "Delete" }).click();
  await reader.getByRole("button", { name: "Delete comment" }).click();
  await expect(reader.getByText("Comment deleted")).toBeVisible();
  await expect(comments.getByText("This comment was deleted.")).toBeVisible();
  await expect(comments.getByText(`Thanks for reading ${stamp}`)).toBeVisible();
  await expect(
    comments.getByRole("heading", { name: "2 comments" }),
  ).toBeVisible();

  // It's all there after a reload, and listed under Account → Comments.
  await reader.reload();
  await expect(comments.getByText("This comment was deleted.")).toBeVisible();
  await reader.goto("/account/comments");
  const mine = reader.getByRole("main");
  await expect(mine.getByRole("link", { name: title })).toBeVisible();
  await expect(
    mine.getByText(`Second thoughts, edited ${stamp}`),
  ).toBeVisible();
  await expect(mine.getByText(`First thoughts ${stamp}`)).toHaveCount(0);
  await guest.close();
});
