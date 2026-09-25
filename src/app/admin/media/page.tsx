import { HardDrive } from "lucide-react";
import type { Metadata } from "next";

import { MediaBrowser } from "@/components/admin/media/media-browser";
import { PageHeader } from "@/components/admin/page-header";
import { env } from "@/env";
import { requirePermission } from "@/lib/auth/session";
import { formatBytes, MEDIA_MAX_BYTES } from "@/lib/media/constants";
import { listMedia } from "@/lib/queries/media";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const session = await requirePermission("media:upload");
  const initialPage = await listMedia(session);

  return (
    <>
      <PageHeader
        title="Media"
        description={`Images for posts and cover art. JPEG, PNG, WebP, GIF, or AVIF up to ${formatBytes(MEDIA_MAX_BYTES)}.`}
      />
      {env.STORAGE_DRIVER === "local" && (
        <p className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
          <HardDrive className="size-3.5" />
          Using local development storage (./.uploads). Set STORAGE_DRIVER=r2
          for Cloudflare R2.
        </p>
      )}
      <MediaBrowser mode="manage" initialPage={initialPage} />
    </>
  );
}
