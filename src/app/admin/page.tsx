import { Check, X } from "lucide-react";
import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can, type Permission } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

const capabilities: { permission: Permission; label: string }[] = [
  { permission: "post:create", label: "Write posts" },
  { permission: "post:publish", label: "Publish posts" },
  { permission: "post:update:any", label: "Edit anyone's posts" },
  { permission: "tag:manage", label: "Manage tags" },
  { permission: "media:upload", label: "Upload media" },
  { permission: "user:manage", label: "Manage users" },
  { permission: "settings:manage", label: "Change site settings" },
];

export default async function AdminHome() {
  const { user } = await requireSession();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl tracking-tight">
          Hello, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          The full dashboard arrives in Phase 3.
        </p>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Your permissions</CardTitle>
          <CardDescription>What your role allows.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {capabilities.map(({ permission, label }) => {
              const allowed = can(user.role, permission);
              return (
                <li key={permission} className="flex items-center gap-2">
                  {allowed ? (
                    <Check className="text-success size-4" />
                  ) : (
                    <X className="text-muted-foreground size-4" />
                  )}
                  <span className={allowed ? "" : "text-muted-foreground"}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
