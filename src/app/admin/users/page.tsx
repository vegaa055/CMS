import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { InviteButton, PendingInvites } from "@/components/admin/users/invites";
import { UsersTable } from "@/components/admin/users/users-table";
import { UsersTabs } from "@/components/admin/users/users-tabs";
import { requirePermission } from "@/lib/auth/session";
import {
  getPendingInvites,
  getTeamMembers,
  getUserCounts,
} from "@/lib/queries/admin";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requirePermission("user:manage");
  const [team, invites, counts] = await Promise.all([
    getTeamMembers(),
    getPendingInvites(),
    getUserCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Users"
        description="Your team has dashboard access. Role changes take effect immediately."
      >
        <InviteButton />
      </PageHeader>
      <UsersTabs active="team" counts={counts} />
      <UsersTable data={team} currentUserId={session.user.id} />
      <PendingInvites invites={invites} />
    </>
  );
}
