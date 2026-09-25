import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { PostsTable } from "@/components/admin/posts/posts-table";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getAdminPosts } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Posts" };

export default async function PostsPage() {
  const session = await requirePermission("post:create");
  const posts = await getAdminPosts(session);

  return (
    <>
      <PageHeader
        title="Posts"
        description={
          can(session.user.role, "post:update:any")
            ? "All posts on the site."
            : "Posts you've written."
        }
      />
      <PostsTable data={posts} />
    </>
  );
}
