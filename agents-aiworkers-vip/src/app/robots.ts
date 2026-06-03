import type { MetadataRoute } from "next";

import { AGENTS_SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${AGENTS_SITE_URL}/sitemap.xml`,
  };
}
