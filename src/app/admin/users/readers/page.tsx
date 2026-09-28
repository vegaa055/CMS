import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/admin/page-header";
import { InviteButton } from "@/components/admin/users/invites";
import { ReadersTable } from "@/components/admin/users/readers-table";
import { UsersTabs } from "@/components/admin/users/users-tabs";
import { parsePage } from "@/components/site/pagination";
import { requirePermission } from "@/lib/auth/session";
import { getReaders, getUserCounts } from "@/lib/queries/admin";
import { getReaderSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Readers" };

export default async function ReadersPage({
  searchParams,
}: PageProps<"/admin/users/readers">) {
  await requirePermission("user:manage");
  const params = await searchParams;
  const page = parsePage(params.page);
  if (!page) notFound();
  const query = (typeof params.q === "string" ? params.q : "")
    .trim()
    .slice(0, 100);

  const [readers, counts, { signupEnabled }] = await Promise.all([
    getReaders({ page, query }),
    getUserCounts(),
    getReaderSettings(),
  ]);
  // e.g. the last reader on the last page was removed.
  if (page > readers.pageCount) {
    const last = new URLSearchParams(query ? { q: query } : {});
    if (readers.pageCount > 1) last.set("page", String(readers.pageCount));
    redirect(`/admin/users/readers${last.size ? `?${last}` : ""}`);
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Readers can sign in to the public site. They never get dashboard access unless you change their role."
      >
        <InviteButton />
      </PageHeader>
      <UsersTabs active="readers" counts={counts} />
      <ReadersTable
        rows={readers.rows}
        total={readers.total}
        page={page}
        pageCount={readers.pageCount}
        query={query}
        signupEnabled={signupEnabled}
      />
    </>
  );
}
