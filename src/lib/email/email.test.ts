import { describe, expect, it } from "vitest";

import { fromHeader, isDeliverableAddress } from "./recipients";
import {
  escapeHtml,
  inviteMessage,
  resetPasswordMessage,
  verifyEmailMessage,
  withArticle,
} from "./templates";

const url =
  "https://www.example.org/api/auth/verify-email?token=abc&callbackURL=%2F";

describe("templates", () => {
  it("escape everything interpolated into the HTML", () => {
    const mail = verifyEmailMessage({
      siteName: "Site <b>",
      name: `<script>alert("x")</script>`,
      url,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)");
    expect(mail.html).toContain("Site &lt;b&gt;");
    // Query-string ampersands are escaped inside attributes.
    expect(mail.html).toContain(
      'href="https://www.example.org/api/auth/verify-email?token=abc&amp;callbackURL=%2F"',
    );
  });

  it("include a plain-text version with the raw link", () => {
    const mail = resetPasswordMessage({ siteName: "Astral", name: "Sam", url });
    expect(mail.subject).toBe("Reset your Astral password");
    expect(mail.text).toContain(`Choose a new password: ${url}`);
    expect(mail.text).not.toContain("<");
  });

  it("word invitations naturally", () => {
    const mail = inviteMessage({
      siteName: "Astral",
      inviterName: "Tony",
      role: "editor",
      url,
      days: 7,
    });
    expect(mail.subject).toBe("Tony invited you to Astral");
    expect(mail.text).toContain("join Astral as an editor");
    expect(mail.text).toContain("expires in 7 days");
    expect(withArticle("author")).toBe("an author");
    expect(withArticle("reader")).toBe("a reader");
  });

  it("escapeHtml covers the five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("recipients", () => {
  it("never delivers to reserved test domains", () => {
    for (const email of [
      "e2e-admin@folio.local",
      "a@localhost",
      "b@site.test",
      "c@example.com",
      "d@mail.example.org",
      "e@nowhere.invalid",
    ]) {
      expect(isDeliverableAddress(email)).toBe(false);
    }
    expect(isDeliverableAddress("reader@gmail.com")).toBe(true);
    expect(isDeliverableAddress("welcome@astral-vega.com")).toBe(true);
  });

  it("builds a From header that can't be broken by the site name", () => {
    expect(fromHeader("Astral Vega", "welcome@astral-vega.com")).toBe(
      "Astral Vega <welcome@astral-vega.com>",
    );
    expect(fromHeader("Notes: Vol. 2", "a@b.co")).toBe(
      '"Notes: Vol. 2" <a@b.co>',
    );
    expect(fromHeader('Evil"\r\nBcc: <x>', "a@b.co")).toBe(
      '"EvilBcc: x" <a@b.co>',
    );
    expect(fromHeader("", "a@b.co")).toBe("a@b.co");
  });
});
