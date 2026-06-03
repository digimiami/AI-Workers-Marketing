import { AGENTS_MARKETING_PREFIX } from "@/lib/agents-site/constants";

/** Build internal app path (works on main domain for dev/preview). */
export function agentsInternalPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return AGENTS_MARKETING_PREFIX;
  return `${AGENTS_MARKETING_PREFIX}${normalized}`;
}

/** Public path shown on agents.aiworkers.vip (clean URLs). */
export function agentsPublicPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === AGENTS_MARKETING_PREFIX ? "/" : normalized.replace(AGENTS_MARKETING_PREFIX, "") || "/";
}

export function agentPagePath(slug: string): string {
  return agentsInternalPath(`/agents/${slug}`);
}

export function agentPublicPath(slug: string): string {
  return `/agents/${slug}`;
}
