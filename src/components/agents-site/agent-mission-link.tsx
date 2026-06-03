"use client";

import Link from "next/link";

import { useAgentsHref } from "@/components/agents-site/agents-link-context";

export function AgentMissionControlLink() {
  const href = useAgentsHref();
  return (
    <Link href={href("/mission-control")} className="text-primary hover:underline">
      Mission Control
    </Link>
  );
}
