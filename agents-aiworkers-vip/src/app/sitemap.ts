import type { MetadataRoute } from "next";

import { AGENT_SLUGS } from "@/lib/catalog";
import { AGENTS_SITE_URL, agentPublicPath } from "@/lib/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = AGENTS_SITE_URL;
  const now = new Date();

  const staticRoutes = ["", "/mission-control", "/skills"].map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const agentRoutes = AGENT_SLUGS.map((slug) => ({
    url: `${base}${agentPublicPath(slug)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...agentRoutes];
}
