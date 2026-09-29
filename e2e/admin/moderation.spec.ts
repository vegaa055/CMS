import type { Browser, Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import { sql } from "../db";
import { waitForEmail } from "../emails";
import { expect, test } from "../fixtures";
import { randomPassword } from "../passwords";

/**
 * Moderation end to end: a blocked word and a reader's report send comments
 * to the queue, "Spam + ban" signs the spammer out for good (until
 * unbanned), and a reply notification's unsubscribe link turns that email
 * off.
 */
const stamp = Date.now();
const slug = `e2e-moderation-${stamp}`;
const title = `E2E Moderation ${stamp}`;
const SPAMMER = { id: `e2e-spammer-${stamp}`, name: `E2E Spammer ${stamp}` };
const REPORTER = { id: `e2e-reporter-${stamp}`, name: `E2E Reporter ${stamp}` };
const emailOf = (who: { id: string }) => `${who.id}@folio.local`;
const password = randomPassword();

const SETTINGS = {
  "comments.enabled": true,
  "comments.moderation": "none",
  "comments.blockedWords": ["casino"],
  "comments.linkLimit": 3,
};
let original: { key: string; value: unknown }[] = [];

// Our own post and readers (the e2e teardown removes them, and the comments
// with the post); comment settings are set for the run and put back after.
test.beforeAll(async () => {
  const db = sql();
  const keys = Object.keys(SETTINGS);
  original =
    (await db`select key, value from settings where key = any(${keys})`) as typeof original;
  for (const [key, value] of Object.entries(SETTINGS)) {
    await db`insert into settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)
      on conflict (key) do update set value = excluded.value`;
  }
  await db`insert into posts (title, slug, content, content_text, status, published_at)
    values (${title}, ${slug}, ${JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Discuss." }] }] })}::jsonb,
      'Discuss.', 'published', now() - interval '1 hour')`;
  const hash = await hashPassword(password);
  for (const who of [SPAMMER, REPORTER]) {
    await db`insert into "user" (id, name, email, email_verified, role)
      values (${who.id}, ${who.name}, ${emailOf(who)}, true, 'reader')`;
    await db`insert into account (id, account_id, provider_id, user_id, password)
      values (${`${who.id}-credential`}, ${who.id}, 'credential', ${who.id}, ${hash})`;
  }
});

test.afterAll(async () => {
  const db = sql();
  await db`delete from settings where key = any(${Object.keys(SETTINGS)})`;
  for (const { key, value } of original) {
    await db`insert into settings (key, value) values (${key}, ${JSON.stringify(value)}::jsonb)`;
  }
});

const comments = (page: Page) =>
  page.getByRole("region", { name: /^(Comments|\d+ comments?)$/ });

/** A reader, signed in through the form, on the post. */
async function readerOnPost(
  browser: Browser,
  baseURL: string | undefined,
  who: { id: string },
) {
  const context = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto(`/login?next=/posts/${slug}`);
  await page.getByLabel("Email").fill(emailOf(who));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseURL}/posts/${slug}`);
  return page;
}

async function comment(page: Page, text: string) {
  await comments(page)
    .getByRole("textbox", { name: "Add a comment" })
    .fill(text);
  await comments(page).getByRole("button", { name: "Post comment" }).click();
}

test("blocked words and reports reach the queue, and spam + ban works", async ({
  page,
  browser,
  baseURL,
}) => {
  const hello = `Hello from the spammer ${stamp}`;
  const casino = `Best casino bonus ${stamp}`;

  // A plain comment publishes; one with a blocked word waits.
  const spammer = await readerOnPost(browser, baseURL, SPAMMER);
  await comment(spammer, hello);
  await expect(spammer.getByText("Comment posted")).toBeVisible();
  await comment(spammer, casino);
  await expect(
    spammer.getByText(/appear once a moderator approves/),
  ).toBeVisible();

  // Another reader reports the published one; it's hidden for them at once.
  const reporter = await readerOnPost(browser, baseURL, REPORTER);
  const published = comments(reporter)
    .getByRole("article")
    .filter({ hasText: hello });
  await published.getByRole("button", { name: "Report" }).click();
  const dialog = reporter.getByRole("alertdialog");
  await dialog.getByRole("radio", { name: "Spam or advertising" }).check();
  await dialog.getByRole("button", { name: "Report comment" }).click();
  await expect(
    reporter.getByText(/A moderator will take a look/),
  ).toBeVisible();
  await expect(published).toHaveCount(0);

  // The queue says why each one waits; one click deals with the spammer.
  await page.goto("/admin/comments");
  const queue = page.getByRole("main");
  const reported = queue.getByRole("listitem").filter({ hasText: hello });
  await expect(
    reported.getByText("Reported by 1 reader: Spam or advertising"),
  ).toBeVisible();
  const held = queue.getByRole("listitem").filter({ hasText: casino });
  await expect(held.getByText("Contains “casino”")).toBeVisible();
  await held.getByRole("button", { name: "Spam + ban" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Spam + ban" })
    .click();
  await expect(
    page.getByText(`Marked as spam and banned ${SPAMMER.name}`),
  ).toBeVisible();
  await expect(queue.getByText(hello)).toHaveCount(0);
  await expect(queue.getByText(casino)).toHaveCount(0);

  // The spammer is signed out, and can't sign back in.
  await spammer.reload();
  await expect(
    comments(spammer).getByRole("link", { name: "Sign in to comment" }),
  ).toBeVisible();
  await spammer.goto("/login");
  await spammer.getByLabel("Email").fill(emailOf(SPAMMER));
  await spammer.getByLabel("Password").fill(password);
  await spammer.getByRole("button", { name: "Sign in" }).click();
  await expect(
    spammer.getByText("This account has been suspended."),
  ).toBeVisible();

  // An admin can lift the ban from Users → Readers.
  await page.goto("/admin/users/readers");
  await page
    .getByRole("searchbox", { name: /Search readers/ })
    .fill(SPAMMER.name);
  await page.keyboard.press("Enter");
  const row = page.getByRole("table").getByRole("row").filter({
    hasText: SPAMMER.name,
  });
  await expect(row.getByText("Banned")).toBeVisible();
  await row
    .getByRole("button", { name: `Actions for ${SPAMMER.name}` })
    .click();
  await page.getByRole("menuitem", { name: "Unban" }).click();
  await expect(
    page.getByText(`${SPAMMER.name} is no longer banned`),
  ).toBeVisible();
  await expect(row.getByText("Banned")).toHaveCount(0);

  await spammer.context().close();
  await reporter.context().close();
});

test("reply emails can be turned off from their unsubscribe link", async ({
  page,
  browser,
  baseURL,
}) => {
  const since = Date.now();
  const question = `A question from the reporter ${stamp}`;
  const reader = await readerOnPost(browser, baseURL, REPORTER);
  await comment(reader, question);
  await expect(reader.getByText("Comment posted")).toBeVisible();

  // The team answers from the post.
  await page.goto(`/posts/${slug}`);
  await comments(page)
    .getByRole("article")
    .filter({ hasText: question })
    .getByRole("button", { name: "Reply" })
    .click();
  await comments(page)
    .getByRole("textbox", { name: `Reply to ${REPORTER.name}` })
    .fill(`Good question ${stamp}`);
  await comments(page).getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Reply posted")).toBeVisible();

  // The reader is emailed, and unsubscribes from the link in it.
  const mail = await waitForEmail(emailOf(REPORTER), "comment-reply", since);
  expect(mail.subject).toContain("replied to your comment");
  const unsubscribe = mail.text.match(/Unsubscribe: (\S+)/)?.[1];
  expect(unsubscribe).toBeTruthy();
  await reader.goto(unsubscribe!);
  await reader.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(reader.getByText("You're unsubscribed")).toBeVisible();

  await reader.goto("/account");
  await expect(
    reader.getByRole("switch", { name: "Replies to my comments" }),
  ).not.toBeChecked();
  await reader.context().close();
});
