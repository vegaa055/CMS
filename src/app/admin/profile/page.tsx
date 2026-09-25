import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { PasswordForm } from "@/components/admin/profile/password-form";
import { ProfileForm } from "@/components/admin/profile/profile-form";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user } = await requireSession();

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account and public author details."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        <ProfileForm
          email={user.email}
          initial={{
            name: user.name,
            username: user.username ?? "",
            bio: user.bio ?? "",
            image: user.image ?? "",
          }}
        />
        <PasswordForm />
      </div>
    </>
  );
}
