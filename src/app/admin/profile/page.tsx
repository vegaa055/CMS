import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/admin/page-header";
import { ProfileForm } from "@/components/admin/profile/profile-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { user } = await requirePermission("dashboard:view");

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your public author details: byline, photo, and author page."
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
        <Card>
          <CardHeader>
            <CardTitle>Account settings</CardTitle>
            <CardDescription>
              Password, email address, signed-in devices, and deleting your
              account.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" asChild>
                <Link href="/account">
                  Open <ArrowUpRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
        </Card>
      </div>
    </>
  );
}
