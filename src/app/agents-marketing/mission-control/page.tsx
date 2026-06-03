import type { Metadata } from "next";

import { MissionControlPageContent } from "@/components/agents-site/mission-control-page";
import { AGENTS_SITE_URL } from "@/lib/agents-site/constants";

export const metadata: Metadata = {
  title: "Mission Control — AI Workforce Dashboard",
  description:
    "Command center for connected AI agents: task assignment, workflow automation, analytics, collaboration, notifications, and reporting.",
  alternates: { canonical: `${AGENTS_SITE_URL}/mission-control` },
};

export default function MissionControlPage() {
  return <MissionControlPageContent />;
}
