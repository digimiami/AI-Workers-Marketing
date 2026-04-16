import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  GitBranch,
  LineChart,
  Mail,
  MousePointerClick,
  PenLine,
  Radar,
  Send,
  Video,
} from "lucide-react";

import type { WorkerKey } from "@/lib/workersCatalog";

export const WORKER_ICONS: Record<WorkerKey, LucideIcon> = {
  "opportunity-scout": Radar,
  "funnel-architect": GitBranch,
  "content-strategist": PenLine,
  "video-worker": Video,
  "publishing-worker": Send,
  "lead-nurture-worker": Mail,
  "conversion-worker": MousePointerClick,
  "analyst-worker": LineChart,
};

export function WorkerIcon({ workerKey, className }: { workerKey: WorkerKey; className?: string }) {
  const Icon = WORKER_ICONS[workerKey] ?? BarChart3;
  return <Icon className={className} aria-hidden />;
}
