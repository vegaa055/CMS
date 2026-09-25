import { cookies } from "next/headers";

import { AdminHeader } from "@/components/admin/admin-header";
import { AppSidebar } from "@/components/admin/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requirePermission } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/settings";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [{ user }, site] = await Promise.all([
    requirePermission("dashboard:view"),
    getSiteSettings(),
  ]);
  // Persisted by the sidebar component so the collapsed state survives reloads.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  const navUser = {
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  };

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar user={navUser} siteName={site.name} />
        <SidebarInset>
          <AdminHeader role={user.role} />
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
