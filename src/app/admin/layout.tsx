import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { requireUser } from "@/services/auth/authService";
import { AdminOrgControls } from "@/app/admin/AdminOrgControls";
import { AdminSidebar } from "@/app/admin/AdminSidebar";
import { PanelLeft } from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const orgId = await getCurrentOrgIdFromCookie();
  // If no current org is selected, force onboarding.
  if (!orgId) {
    return (
      <div className="min-h-screen p-6 bg-background">{children}</div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 border-b border-border/60 bg-background/70 supports-[backdrop-filter]:backdrop-blur glass-panel">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="AiWorkers" width={18} height={18} priority />
            <span className="font-display text-sm font-bold tracking-tight text-gradient-fx">AiWorkers</span>
          </Link>
          <Sheet>
            <SheetTrigger
              render={<Button size="sm" variant="outline" className="border-border/80" />}
              aria-label="Open menu"
              title="Open menu"
            >
              <PanelLeft className="h-4 w-4 mr-2" />
              Menu
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <div className="border-r border-border/60 glass-panel h-full">
                <AdminSidebar
                  header={
                    <Link href="/" className="flex items-center gap-2">
                      <Image src="/logo.svg" alt="AiWorkers" width={18} height={18} priority />
                      <span className="font-display text-sm font-bold tracking-tight text-gradient-fx">AiWorkers</span>
                    </Link>
                  }
                  footer={
                    <>
                      <Separator className="my-4 opacity-60" />
                      <AdminOrgControls currentOrgId={orgId} />
                    </>
                  }
                  defaultCollapsed={false}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr]">
        <aside className="hidden md:block border-r border-border/60 glass-panel md:min-h-screen">
          <div className="md:sticky md:top-0">
            <AdminSidebar
              header={
                <Link href="/" className="flex items-center gap-2">
                  <Image src="/logo.svg" alt="AiWorkers" width={18} height={18} priority />
                  <span className="font-display text-sm font-bold tracking-tight text-gradient-fx">AiWorkers</span>
                </Link>
              }
              footer={
                <>
                  <Separator className="my-4 opacity-60" />
                  <AdminOrgControls currentOrgId={orgId} />
                </>
              }
            />
          </div>
        </aside>
        <main className="p-5 md:p-8 md:max-w-[1440px]">{children}</main>
      </div>
    </div>
  );
}

