import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { TagsTable } from "@/components/admin/tags/tags-table";
import { requirePermission } from "@/lib/auth/session";
import { getAdminTags } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsPage() {
  await requirePermission("tag:manage");
  const tags = await getAdminTags();

  return (
    <>
      <PageHeader title="Tags" description="Topics used to organize posts." />
      <TagsTable data={tags} />
    </>
  );
}
