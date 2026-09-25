import { can } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { listMedia } from "@/lib/queries/media";

/** GET /api/admin/media?q=&cursor= — paged media for the library and picker. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !can(session.user.role, "media:upload")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const page = await listMedia(session, {
    q: params.get("q")?.slice(0, 100),
    cursor: params.get("cursor"),
  });
  return Response.json(page, { headers: { "cache-control": "no-store" } });
}
