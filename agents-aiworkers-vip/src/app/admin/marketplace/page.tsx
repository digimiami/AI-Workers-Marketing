import type { Metadata } from "next";

import { AgentMarketplaceAdmin } from "@/components/admin/agent-marketplace-admin";

export const metadata: Metadata = {
  title: "Platform Admin — Marketplace",
  robots: { index: false, follow: false },
};

export default function PlatformMarketplacePage() {
  return <AgentMarketplaceAdmin />;
}
