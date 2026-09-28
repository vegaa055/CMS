import { z } from "zod";

import { registrationMode } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { getLikeState } from "@/lib/queries/likes";

/**
 * Like total for a live post, plus the viewer's own like (`liked` is null
 * when signed out, with whether they could sign up). Read by the browser,
 * so cached post pages never need regenerating for a like.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/posts/[id]/likes">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const session = await getSession();
  const state = await getLikeState(id, session?.user.id);
  if (!state) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(
    {
      ...state,
      canSignUp: session ? false : (await registrationMode()) !== "closed",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
