import { Settings } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings:manage");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Site name, branding, and defaults."
      />
      <EmptyState
        icon={Settings}
        title="Settings coming soon"
        description="Editable site name, logo, description, and social links arrive in Phase 7."
      />
    </>
  );
}
