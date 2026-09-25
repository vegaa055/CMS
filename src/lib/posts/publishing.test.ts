import { describe, expect, it } from "vitest";

import { resolvePublishing } from "./publishing";
import { effectiveStatus } from "./status";

const now = new Date("2026-06-01T12:00:00Z");
const past = new Date("2026-05-01T12:00:00Z");
const future = new Date("2026-07-01T12:00:00Z");

describe("resolvePublishing", () => {
  it("clears the date when reverting to draft", () => {
    expect(
      resolvePublishing("draft", past.toISOString(), undefined, now),
    ).toEqual({ status: "draft", publishedAt: null });
  });

  it("publishes now when no date is given", () => {
    expect(resolvePublishing("published", null, undefined, now)).toEqual({
      status: "published",
      publishedAt: now,
    });
  });

  it("keeps the original publish date when updating a live post", () => {
    expect(
      resolvePublishing(
        "published",
        null,
        { status: "published", publishedAt: past },
        now,
      ),
    ).toEqual({ status: "published", publishedAt: past });
  });

  it("turns a future publish date into a schedule", () => {
    expect(
      resolvePublishing("published", future.toISOString(), undefined, now),
    ).toEqual({ status: "scheduled", publishedAt: future });
  });

  it("requires a date to schedule", () => {
    expect(resolvePublishing("scheduled", null, undefined, now)).toEqual({
      error: expect.any(String),
    });
  });

  it("publishes immediately when scheduled in the past", () => {
    expect(
      resolvePublishing("scheduled", past.toISOString(), undefined, now),
    ).toEqual({ status: "published", publishedAt: past });
  });

  it("keeps the publish date when archiving", () => {
    expect(
      resolvePublishing(
        "archived",
        null,
        { status: "published", publishedAt: past },
        now,
      ),
    ).toEqual({ status: "archived", publishedAt: past });
  });
});

describe("effectiveStatus", () => {
  it("treats past-due scheduled posts as published", () => {
    expect(effectiveStatus("scheduled", past, now)).toBe("published");
    expect(effectiveStatus("scheduled", future, now)).toBe("scheduled");
    expect(effectiveStatus("draft", past, now)).toBe("draft");
  });
});
