import Link from "next/link";

import { signOutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { requireUser } from "@/services/auth/authService";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/campaigns", label: "Campaigns" },
  { href: "/admin/funnels", label: "Funnels" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/email", label: "Email Sequences" },
  { href: "/admin/ai-workers", label: "AI Workers" },
  { href: "/admin/ai-workers/runs", label: "Agent runs" },
  { href: "/admin/approvals", label: "Approval Queue" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Logs" },
];

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
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[272px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-border/60 glass-panel md:min-h-screen">
        <div className="p-4 md:sticky md:top-0 md:py-6">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="font-display text-sm font-bold tracking-tight text-gradient-fx">
              AiWorkers
            </Link>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <form action={signOutAction}>
                <Button size="sm" variant="outline" type="submit" className="border-border/80">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
          <Separator className="my-4 opacity-60" />
          <nav className="space-y-0.5">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/70 border border-transparent hover:border-border/50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <main className="p-6 md:p-8 md:max-w-[1400px]">{children}</main>
    </div>
  );
}

