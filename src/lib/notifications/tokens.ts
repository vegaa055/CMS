import { createHmac, timingSafeEqual } from "node:crypto";

import { NOTIFICATION_KINDS, type NotificationKind } from "./kinds";

/*
 * Unsubscribe links carry a signed token naming the person and the kind of
 * email, so they work from any inbox without signing in and can't be forged
 * for someone else. They don't expire: an old email's link should still work.
 */

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`unsubscribe:${payload}`)
    .digest("base64url");
}

export function createUnsubscribeToken(
  userId: string,
  kind: NotificationKind,
  secret: string,
) {
  const payload = `${kind}:${userId}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload, secret)}`;
}

/** The person and kind a token is for, or null if it's not genuine. */
export function readUnsubscribeToken(token: string, secret: string) {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra !== undefined) return null;
  const payload = Buffer.from(encoded, "base64url").toString();
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return null;
  }
  const separator = payload.indexOf(":");
  const kind = payload.slice(0, separator);
  const userId = payload.slice(separator + 1);
  if (
    separator < 0 ||
    !userId ||
    !(NOTIFICATION_KINDS as readonly string[]).includes(kind)
  ) {
    return null;
  }
  return { userId, kind: kind as NotificationKind };
}
