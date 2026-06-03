import type { Metadata } from "next";

import { AgentsHomePage } from "@/components/agents-site/home-sections";
import { AGENTS_SITE_TAGLINE, AGENTS_SITE_URL } from "@/lib/agents-site/constants";

export const metadata: Metadata = {
  title: "Hire an AI Workforce That Works 24/7",
  description:
    "Agents.AIWorkers.vip — specialist AI workers for marketing, sales, and operations with Mission Control and a Skills Marketplace.",
  alternates: { canonical: AGENTS_SITE_URL },
  openGraph: {
    title: AGENTS_SITE_TAGLINE,
    description:
      "Hire Social, YouTube, Email, SEO, Ads, Ecommerce, Support, Research, Content, and Sales AI workers.",
    url: AGENTS_SITE_URL,
  },
};

export default function AgentsMarketingHomePage() {
  return <AgentsHomePage />;
}
