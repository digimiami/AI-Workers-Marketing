import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiPlan, RunAiMarketingAgentInput, RunAiMarketingAgentOutput } from "@/services/ai-agent/types";
import { planOnly, routeAndRun } from "@/services/ai-agent/providerRouter";

type Db = SupabaseClient;

export async function buildAiMarketingPlan(input: RunAiMarketingAgentInput): Promise<AiPlan> {
  return planOnly(input);
}

export async function runAiMarketingAgent(params: {
  db: Db;
  input: RunAiMarketingAgentInput;
  plan: AiPlan;
}): Promise<RunAiMarketingAgentOutput> {
  return routeAndRun(params);
}

