"use client";

import Link from "next/link";

import {
  BarChart3,
  Bell,
  Bot,
  ClipboardList,
  FileBarChart,
  GitBranch,
  MessageSquare,
  Users,
} from "lucide-react";

import { ConversionCtaBanner, ConversionCtas } from "@/components/conversion-ctas";
import { Reveal } from "@/components/marketing/motion-primitives";
import { SectionHeader } from "@/components/marketing/section-header";
import { Badge } from "@/components/ui/badge";
import { getAgentIcon } from "@/lib/agent-icons";
import { AGENT_CATALOG_DATA } from "@/lib/catalog";
import { agentPublicPath } from "@/lib/constants";

const CAPABILITIES = [
  {
    icon: Bot,
    title: "All connected agents",
    description: "Roster view with status, last run, error rate, and assigned skills per worker.",
  },
  {
    icon: ClipboardList,
    title: "Task assignment",
    description: "Create tasks, set priority, attach context, and route to the right specialist agent.",
  },
  {
    icon: GitBranch,
    title: "Workflow automation",
    description: "Multi-step flows with branches, waits, approvals, and handoffs between agents.",
  },
  {
    icon: BarChart3,
    title: "Analytics dashboard",
    description: "Unified KPIs across content, ads, email, support, and revenue—filterable by agent.",
  },
  {
    icon: Users,
    title: "Agent collaboration",
    description: "Shared threads and context so Research, Content, and Social stay aligned.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Slack, email, or in-app alerts for approvals, failures, and milestone completions.",
  },
  {
    icon: FileBarChart,
    title: "Reporting center",
    description: "Scheduled PDF/CSV exports for executives and client delivery workflows.",
  },
  {
    icon: MessageSquare,
    title: "Command interface",
    description: "Natural-language commands that map to structured agent runs with audit trail.",
  },
];

export function MissionControlPageContent() {
  return (
    <>
      <section className="mkt-page pt-16 md:pt-24">
        <Reveal className="max-w-3xl space-y-4">
          <Badge className="border-primary/30 bg-primary/10">Mission Control</Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            One dashboard to <span className="text-gradient-fx">run your AI workforce</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Assign work, automate handoffs, approve high-risk outputs, and measure every agent from a single command
            center.
          </p>
          <ConversionCtas />
        </Reveal>
      </section>

      <section className="border-t border-border/50">
        <div className="mkt-page">
          <SectionHeader title="Everything operators need" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.04}>
                <div className="flex gap-4 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl dark:border-white/[0.08]">
                  <c.icon className="size-8 shrink-0 text-primary" aria-hidden />
                  <div>
                    <h3 className="font-display font-bold">{c.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50 bg-muted/10">
        <div className="mkt-page">
          <SectionHeader title="Connected agents" description="Workers available in your roster today." />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_CATALOG_DATA.map((a) => {
              const Icon = getAgentIcon(a.iconKey);
              return (
                <Link
                  key={a.slug}
                  href={agentPublicPath(a.slug)}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3 transition-colors hover:border-primary/30"
                >
                  <Icon className="size-5 text-primary" aria-hidden />
                  <span className="text-sm font-medium">{a.shortTitle}</span>
                  <span className="ml-auto text-[10px] text-emerald-400">ready</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border/50">
        <div className="mkt-page pb-20">
          <div className="rounded-2xl border border-border/60 bg-card/30 p-4 backdrop-blur-md md:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              {["Tasks", "Workflows", "Reports"].map((tab) => (
                <div
                  key={tab}
                  className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-8 text-center text-sm text-muted-foreground"
                >
                  {tab} panel · live in app
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12">
            <ConversionCtaBanner />
          </div>
        </div>
      </section>
    </>
  );
}
