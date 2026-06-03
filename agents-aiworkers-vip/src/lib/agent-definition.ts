import type { LucideIcon } from "lucide-react";

import { getAgentIcon } from "@/lib/agent-icons";
import {
  AGENT_BY_SLUG,
  AGENT_CATALOG_DATA,
  type AgentDefinitionData,
} from "@/lib/catalog";

export type AgentDefinition = AgentDefinitionData & { icon: LucideIcon };

export const AGENT_CATALOG: AgentDefinition[] = AGENT_CATALOG_DATA.map((a) => ({
  ...a,
  icon: getAgentIcon(a.iconKey),
}));

export const AGENT_WITH_ICON_BY_SLUG: Record<string, AgentDefinition> = Object.fromEntries(
  AGENT_CATALOG.map((a) => [a.slug, a]),
) as Record<string, AgentDefinition>;

export function getAgentBySlug(slug: string): AgentDefinition | undefined {
  return AGENT_WITH_ICON_BY_SLUG[slug];
}
