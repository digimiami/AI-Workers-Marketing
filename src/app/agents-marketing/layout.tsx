import type { Metadata } from "next";
import { headers } from "next/headers";

import { AgentsLinkProvider } from "@/components/agents-site/agents-link-context";
import { AgentsShell } from "@/components/agents-site/agents-shell";
import {
  AGENTS_HOSTS,
  AGENTS_MARKETING_PREFIX,
  AGENTS_SITE_NAME,
  AGENTS_SITE_URL,
} from "@/lib/agents-site/constants";

export const metadata: Metadata = {
  metadataBase: new URL(AGENTS_SITE_URL),
  title: {
    default: `${AGENTS_SITE_NAME} — AI Workforce for Business`,
    template: `%s · ${AGENTS_SITE_NAME}`,
  },
  description:
    "Hire specialized AI workers for social, YouTube, email, SEO, ads, ecommerce, support, research, content, and sales. Mission Control + Skills Marketplace included.",
  openGraph: {
    type: "website",
    siteName: AGENTS_SITE_NAME,
    url: AGENTS_SITE_URL,
  },
  robots: { index: true, follow: true },
};

async function resolveLinkPrefix(): Promise<string> {
  const h = await headers();
  const host = (h.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  return AGENTS_HOSTS.has(host) ? "" : AGENTS_MARKETING_PREFIX;
}

export default async function AgentsMarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const linkPrefix = await resolveLinkPrefix();

  return (
    <AgentsLinkProvider linkPrefix={linkPrefix}>
      <AgentsShell>{children}</AgentsShell>
    </AgentsLinkProvider>
  );
}
