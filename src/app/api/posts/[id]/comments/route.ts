import { z } from "zod";

import { registrationMode } from "@/lib/auth";
import { can, isStaff } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { initialCommentStatus } from "@/lib/comments";
import {
  getCommentablePost,
  getViewerPendingComments,
  hasApprovedComment,
} from "@/lib/queries/comments";
import { getCommentSettings } from "@/lib/settings";

/**
 * The viewer's side of a live post's comments: who they are, whether they
 * can comment (and whether it'd wait for a moderator), and their own
 * comments awaiting approval. The approved thread is part of the cached
 * page; this is read by the browser.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/posts/[id]/comments">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const [post, session, settings] = await Promise.all([
    getCommentablePost(id),
    getSession(),
    getCommentSettings(),
  ]);
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  const open = settings.enabled && post.commentsEnabled;
  const headers = { "Cache-Control": "private, no-store" };

  if (!session) {
    return Response.json(
      {
        open,
        viewer: null,
        canSignUp: (await registrationMode()) !== "closed",
        pending: [],
      },
      { headers },
    );
  }

  const { user } = session;
  const staff = isStaff(user.role);
  const [pending, approvedBefore] = await Promise.all([
    getViewerPendingComments(post.id, user.id, post.authorId),
    !staff && settings.moderation === "first"
      ? hasApprovedComment(user.id)
      : false,
  ]);
  return Response.json(
    {
      open,
      viewer: {
        id: user.id,
        name: user.name,
        // The team is invited with confirmed addresses.
        verified: staff || user.emailVerified,
        email: user.email,
        moderator: can(user.role, "comment:moderate"),
        // Whether their next comment waits for a moderator.
        held:
          initialCommentStatus({
            staff,
            mode: settings.moderation,
            hasApprovedComment: approvedBefore,
          }) === "pending",
      },
      canSignUp: false,
      pending,
    },
    { headers },
  );
}
