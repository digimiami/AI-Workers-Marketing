import type { Metadata } from "next";

import { SkillsMarketplacePageContent } from "@/components/skills-marketplace-page";
import { AGENTS_SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Skills Marketplace — Extend Your AI Workers",
  description:
    "Searchable skills catalog with categories, ratings, and one-click install for your AI workforce.",
  alternates: { canonical: `${AGENTS_SITE_URL}/skills` },
};

export default function SkillsPage() {
  return <SkillsMarketplacePageContent />;
}
