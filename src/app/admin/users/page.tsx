import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { InviteButton, PendingInvites } from "@/components/admin/users/invites";
import { UsersTable } from "@/components/admin/users/users-table";
import { requirePermission } from "@/lib/auth/session";
import { getAdminUsers, getPendingInvites } from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requirePermission("user:manage");
  const [users, invites] = await Promise.all([
    getAdminUsers(),
    getPendingInvites(),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with access to the dashboard. Role changes take effect immediately."
      >
        <InviteButton />
      </PageHeader>
      <UsersTable data={users} currentUserId={session.user.id} />
      <PendingInvites invites={invites} />
    </>
  );
}
