import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { requirePermission } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const settings = await getSiteSettings();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Site name, branding, and links. Changes go live immediately."
      />
      <SettingsForm initial={settings} />
    </>
  );
}
