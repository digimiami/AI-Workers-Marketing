import { z } from "zod";

export const missionWorkerKeySchema = z.enum([
  "marketing_worker",
  "funnel_worker",
  "website_worker",
  "content_worker",
  "email_worker",
  "analytics_worker",
  "crm_worker",
]);
export type MissionWorkerKey = z.infer<typeof missionWorkerKeySchema>;

export const missionIntentSchema = z.enum([
  "create_campaign",
  "build_landing_page",
  "build_funnel",
  "create_ads",
  "create_email_sequence",
  "generate_content",
  "connect_integration",
  "analyze_performance",
  "launch_campaign",
  "optimize_campaign",
  "lead_generation_playbook",
  "unknown",
]);
export type MissionIntent = z.infer<typeof missionIntentSchema>;

export type MissionWorkerDefinition = {
  key: MissionWorkerKey;
  name: string;
  description: string;
  legacyAgentKeys: string[];
  capabilities: string[];
  integrationProviders: string[];
};

export type RoutedMissionCommand = {
  intent: MissionIntent;
  confidence: number;
  primaryWorker: MissionWorkerKey;
  supportingWorkers: MissionWorkerKey[];
  aiMode:
    | "create_campaign"
    | "improve_campaign"
    | "generate_content"
    | "build_funnel"
    | "build_email_sequence"
    | "analyze_performance"
    | "create_ads"
    | "setup_lead_capture";
  summary: string;
  suggestedPlaybookSteps: string[];
};

export const missionCommandBodySchema = z.object({
  organizationId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
  execute: z.boolean().optional(),
});
