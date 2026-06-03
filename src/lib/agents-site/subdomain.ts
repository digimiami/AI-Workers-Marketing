import type { NextRequest } from "next/server";

import { AGENTS_HOSTS, AGENTS_MARKETING_PREFIX } from "@/lib/agents-site/constants";

export function isAgentsSubdomain(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  return AGENTS_HOSTS.has(host);
}

const SKIP_PREFIXES = ["/_next", "/api", "/favicon", "/logo", "/admin", "/login", "/signup", "/book", "/demo"];

export function shouldRewriteForAgentsSite(pathname: string): boolean {
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  if (pathname.startsWith(AGENTS_MARKETING_PREFIX)) return false;
  return true;
}

export function agentsRewritePath(pathname: string): string {
  if (pathname === "/") return AGENTS_MARKETING_PREFIX;
  return `${AGENTS_MARKETING_PREFIX}${pathname}`;
}
