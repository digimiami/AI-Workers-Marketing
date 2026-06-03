import Link from "next/link";

import { PlatformAdminGate } from "@/components/admin/platform-admin-gate";
import { PLATFORM_MARKETPLACE_PATH } from "@/lib/constants";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 fx-atmosphere opacity-60" aria-hidden />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PlatformAdminGate>
          <nav className="mb-8 flex gap-4 text-sm">
            <Link
              href={PLATFORM_MARKETPLACE_PATH}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Marketplace
            </Link>
            <Link href="/" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Marketing site
            </Link>
          </nav>
          {children}
        </PlatformAdminGate>
      </div>
    </div>
  );
}
