import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { UsersTable } from "@/components/admin/users/users-table";
import { requirePermission } from "@/lib/auth/session";
import { getAdminUsers } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requirePermission("user:manage");
  const users = await getAdminUsers();

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with access to the dashboard. Invites and role changes arrive in Phase 7."
      />
      <UsersTable data={users} />
    </>
  );
}
