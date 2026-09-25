import { ImageIcon } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  await requirePermission("media:upload");

  return (
    <>
      <PageHeader
        title="Media"
        description="Images and files used across your content."
      />
      <EmptyState
        icon={ImageIcon}
        title="Media library coming soon"
        description="Direct-to-storage uploads on Cloudflare R2 arrive in Phase 5."
      />
    </>
  );
}
