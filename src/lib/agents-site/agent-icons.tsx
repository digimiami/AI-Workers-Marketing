import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Headphones,
  Mail,
  Megaphone,
  PenLine,
  Search,
  Share2,
  ShoppingBag,
  Target,
  Video,
} from "lucide-react";

import type { AgentIconKey } from "@/lib/agents-site/catalog";

export const AGENT_ICON_MAP: Record<AgentIconKey, LucideIcon> = {
  share2: Share2,
  video: Video,
  mail: Mail,
  search: Search,
  megaphone: Megaphone,
  "shopping-bag": ShoppingBag,
  headphones: Headphones,
  "bar-chart": BarChart3,
  "pen-line": PenLine,
  target: Target,
};

export function getAgentIcon(key: AgentIconKey): LucideIcon {
  return AGENT_ICON_MAP[key];
}
