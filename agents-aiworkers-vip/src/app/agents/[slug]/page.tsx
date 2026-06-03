import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgentLandingPage } from "@/components/agent-landing-page";
import { AGENT_SLUGS } from "@/lib/catalog";
import { AGENTS_SITE_URL, agentPublicPath } from "@/lib/constants";
import { getAgentBySlug } from "@/lib/agent-definition";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return AGENT_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgentBySlug(slug);
  if (!agent) return { title: "Agent not found" };

  const canonical = `${AGENTS_SITE_URL}${agentPublicPath(slug)}`;

  return {
    title: agent.seo.title.replace(` | Agents.AIWorkers.vip`, ""),
    description: agent.seo.description,
    keywords: agent.seo.keywords,
    alternates: { canonical },
    openGraph: {
      title: agent.title,
      description: agent.tagline,
      url: canonical,
    },
  };
}

export default async function AgentSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const agent = getAgentBySlug(slug);
  if (!agent) notFound();
  return <AgentLandingPage agent={agent} />;
}
