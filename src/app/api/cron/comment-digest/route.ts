import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { sendModerationDigest } from "@/lib/notifications";

/**
 * The moderators' daily digest. Vercel Cron calls it once a day (see
 * vercel.json) with `Authorization: Bearer <CRON_SECRET>`; anyone else, or
 * any call while CRON_SECRET isn't set, is turned away.
 */
export async function GET(request: Request) {
  const expected = env.CRON_SECRET
    ? Buffer.from(`Bearer ${env.CRON_SECRET}`)
    : null;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    !expected ||
    expected.length !== given.length ||
    !timingSafeEqual(expected, given)
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(await sendModerationDigest());
}
