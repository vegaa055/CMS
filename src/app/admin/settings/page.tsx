import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { CommentSettingsCard } from "@/components/admin/settings/comment-settings";
import { ReaderSettingsCard } from "@/components/admin/settings/reader-settings";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { requirePermission } from "@/lib/auth/session";
import {
  getCommentSettings,
  getReaderSettings,
  getSiteSettings,
} from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const [settings, readerSettings, commentSettings] = await Promise.all([
    getSiteSettings(),
    getReaderSettings(),
    getCommentSettings(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Site identity, links, reader accounts, and comments. Changes go live immediately."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <SettingsForm initial={settings} />
        <ReaderSettingsCard initial={readerSettings} />
        <CommentSettingsCard initial={commentSettings} />
      </div>
    </>
  );
}
