import { describe, expect, it } from "vitest";

import { continueUrl, landingPath, nextParam } from "./landing";

describe("landingPath", () => {
  it("sends the team to the dashboard and readers home by default", () => {
    expect(landingPath("admin")).toBe("/admin");
    expect(landingPath("author")).toBe("/admin");
    expect(landingPath("reader")).toBe("/");
  });

  it("honors a requested page the role can use", () => {
    expect(landingPath("editor", "/admin/posts")).toBe("/admin/posts");
    expect(landingPath("reader", "/posts/hello?x=1")).toBe("/posts/hello?x=1");
    expect(landingPath("author", "/posts/hello")).toBe("/posts/hello");
  });

  it("keeps readers out of team-only pages", () => {
    expect(landingPath("reader", "/admin")).toBe("/");
    expect(landingPath("reader", "/admin/users")).toBe("/");
    expect(landingPath("reader", "/preview/posts/1")).toBe("/");
    // Only whole path segments count.
    expect(landingPath("reader", "/administrivia")).toBe("/administrivia");
    expect(landingPath("reader", "/authors/sam")).toBe("/authors/sam");
  });

  it("never lands on a sign-in page (no redirect loops)", () => {
    expect(landingPath("admin", "/login")).toBe("/admin");
    expect(landingPath("reader", "/register?next=/x")).toBe("/");
    expect(landingPath("reader", "/auth/continue")).toBe("/");
    expect(landingPath("admin", "/reset-password?token=x")).toBe("/admin");
    expect(landingPath("reader", "/verify-email")).toBe("/");
    // Invitations can be accepted after signing in.
    expect(landingPath("reader", "/invite/abc")).toBe("/invite/abc");
  });

  it("rejects off-site redirects", () => {
    for (const next of ["https://evil.example", "//evil.example", "/\\evil"]) {
      expect(landingPath("reader", next)).toBe("/");
      expect(nextParam(next)).toBeUndefined();
    }
  });
});

describe("continueUrl", () => {
  it("carries the requested page through sign-in", () => {
    expect(continueUrl()).toBe("/auth/continue");
    expect(continueUrl("/posts/a b")).toBe(
      "/auth/continue?next=%2Fposts%2Fa%20b",
    );
    expect(nextParam(["/posts/x", "/other"])).toBe("/posts/x");
  });
});
