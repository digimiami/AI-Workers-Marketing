"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  FileBarChart2,
  FileText,
  Inbox,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Mail,
  Megaphone,
  PanelLeft,
  Rocket,
  Settings,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";

import { signOutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
};

type NavGroup = { title: "CORE" | "BUILD" | "INTELLIGENCE" | "SYSTEM"; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "CORE",
    items: [
      { href: "/admin/ai-command", label: "AI Command", icon: Bot, description: "Plan + launch pipeline" },
      { href: "/admin/launch", label: "Autopilot Launch", icon: Rocket, description: "One-click workspace" },
      { href: "/admin/creation-hub", label: "Creation Hub", icon: LayoutGrid, description: "See, test, delete" },
      { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, description: "Workspaces + pipeline" },
      { href: "/admin/approvals", label: "Approvals", icon: CheckCircle2, description: "Review high-risk actions" },
      { href: "/admin", label: "Overview", icon: LayoutGrid, description: "Status + next actions" },
    ],
  },
  {
    title: "BUILD",
    items: [
      { href: "/admin/funnels", label: "Funnels", icon: LayoutTemplate },
      { href: "/admin/content", label: "Content", icon: FileText },
      { href: "/admin/ad-creative", label: "Ad Creative", icon: Sparkles },
      { href: "/admin/email", label: "Email", icon: Mail },
      { href: "/admin/leads", label: "Leads", icon: Users },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/admin/reports", label: "Reports", icon: FileBarChart2 },
      { href: "/admin/ai-workers", label: "AI Workers", icon: Wand2 },
      { href: "/admin/ai-workers/runs", label: "Agent Runs", icon: Activity },
      { href: "/admin/data-sources", label: "Data Sources", icon: Database },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { href: "/admin/organizations", label: "Organizations", icon: Building2 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/logs", label: "Logs", icon: Inbox },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar(props: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [collapsed, setCollapsed] = React.useState(Boolean(props.defaultCollapsed));

  React.useEffect(() => {
    try {
      const v = localStorage.getItem("admin.sidebar.collapsed");
      if (v === "1") setCollapsed(true);
      if (v === "0") setCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("admin.sidebar.collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className={cn("flex h-full flex-col", collapsed ? "w-[88px]" : "w-[272px]")}>
      <div className="p-4 md:py-6">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            {props.header}
          </div>
          <div className={cn("flex items-center gap-0.5", collapsed && "hidden")}>
            <ThemeToggle />
            <Button
              size="sm"
              variant="outline"
              type="button"
              className="border-border/80"
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            variant="outline"
            type="button"
            className={cn("border-border/80", !collapsed && "hidden")}
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {collapsed ? null : <Separator className="my-4 opacity-60" />}

        {collapsed ? null : props.footer}

        <nav className={cn("mt-4 space-y-2", collapsed && "mt-5")}>
          {NAV_GROUPS.map((g) => (
            <div key={g.title} className={cn("rounded-lg", collapsed ? "px-2" : "px-0")}>
              <div
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70",
                  collapsed && "sr-only",
                )}
              >
                {g.title}
              </div>
              <div className={cn("space-y-1", collapsed ? "mt-0" : "mt-1")}>
                {g.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : item.description ?? item.label}
                      className={cn(
                        "group relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        collapsed ? "justify-center px-2" : "justify-start",
                        active
                          ? "border-border/70 bg-accent/60 text-foreground shadow-sm"
                          : "border-transparent text-muted-foreground hover:border-border/50 hover:bg-accent/40 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-foreground" : "text-muted-foreground")} />
                      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                      {active ? (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary/70" />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <Separator className={cn("my-4 opacity-60", collapsed && "mx-2")} />

        <form action={signOutAction} className={cn(collapsed ? "px-2" : "px-0")}>
          <Button
            size="sm"
            variant="outline"
            type="submit"
            className={cn("w-full border-border/80", collapsed && "px-0")}
            title="Sign out"
          >
            <LogOut className={cn("h-4 w-4", collapsed ? "" : "mr-2")} />
            <span className={cn(collapsed && "sr-only")}>Sign out</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
