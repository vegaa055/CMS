import { describe, expect, it } from "vitest";

import { createUnsubscribeToken, readUnsubscribeToken } from "./tokens";

const SECRET = "a-test-secret-that-is-long-enough";

describe("unsubscribe tokens", () => {
  it("round-trips the person and the kind of email", () => {
    const token = createUnsubscribeToken("user:123", "replies", SECRET);
    expect(readUnsubscribeToken(token, SECRET)).toEqual({
      userId: "user:123",
      kind: "replies",
    });
  });

  it("rejects forged, altered, or foreign tokens", () => {
    const token = createUnsubscribeToken("user-1", "digest", SECRET);
    const [payload, signature] = token.split(".");
    const other = Buffer.from("digest:user-2").toString("base64url");
    expect(readUnsubscribeToken(`${other}.${signature}`, SECRET)).toBeNull();
    expect(readUnsubscribeToken(token, `${SECRET}-rotated`)).toBeNull();
    expect(readUnsubscribeToken(`${payload}.`, SECRET)).toBeNull();
    expect(readUnsubscribeToken(`${token}.extra`, SECRET)).toBeNull();
    expect(readUnsubscribeToken("garbage", SECRET)).toBeNull();

    const unknownKind = Buffer.from("marketing:user-1").toString("base64url");
    const signed = createUnsubscribeToken("user-1", "digest", SECRET);
    expect(
      readUnsubscribeToken(`${unknownKind}.${signed.split(".")[1]}`, SECRET),
    ).toBeNull();
  });
});
