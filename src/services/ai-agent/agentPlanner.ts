import { planSchema } from "@/services/ai-agent/types";
import type { AiMode, AiPlan, RunAiMarketingAgentInput } from "@/services/ai-agent/types";

function modeLabel(mode: AiMode) {
  switch (mode) {
    case "create_campaign":
      return "Create new campaign";
    case "improve_campaign":
      return "Improve existing campaign";
    case "generate_content":
      return "Generate content";
    case "build_funnel":
      return "Build funnel";
    case "build_email_sequence":
      return "Build email sequence";
    case "analyze_performance":
      return "Analyze performance";
    case "create_ads":
      return "Create ads";
    case "setup_lead_capture":
      return "Setup lead capture";
    default:
      return mode;
  }
}

export function buildAiPlan(input: Omit<RunAiMarketingAgentInput, "userId" | "organizationId">): AiPlan {
  // Stub planner (internal LLM placeholder): deterministic plan that describes safe tool-based actions.
  const objective = `${modeLabel(input.mode)} for goal: ${input.goal}`;

  const steps: AiPlan["steps"] =
    input.mode === "create_campaign"
      ? [
          {
            name: "Analyze URL and constraints (no external browsing in stub mode)",
            tools_needed: ["log_analytics_event"],
            records_to_create: [],
            approval_required: false,
            risk_level: "low",
          },
          {
            name: "Create campaign draft (metadata containers: funnel/ads/emails)",
            tools_needed: ["create_campaign"],
            records_to_create: ["campaigns"],
            approval_required: input.approvalMode === "required",
            risk_level: "low",
          },
          {
            name: "Create funnel draft + placeholder steps",
            tools_needed: ["create_funnel", "add_funnel_step"],
            records_to_create: ["funnels", "funnel_steps"],
            approval_required: input.approvalMode === "required",
            risk_level: "low",
          },
          {
            name: "Create tracking link (may be gated depending on settings)",
            tools_needed: ["create_tracking_link"],
            records_to_create: ["tracking_links"],
            approval_required: true,
            risk_level: "medium",
          },
          {
            name: "Write summary outputs and log artifacts",
            tools_needed: ["append_agent_run_log"],
            records_to_create: ["agent_outputs", "agent_logs"],
            approval_required: false,
            risk_level: "low",
          },
        ]
      : [
          {
            name: "Plan-only stub for selected mode",
            tools_needed: [],
            records_to_create: [],
            approval_required: true,
            risk_level: "medium",
          },
        ];

  const expected_outputs =
    input.mode === "create_campaign"
      ? ["campaign_id", "funnel_id", "funnel_steps[]", "tracking_link_id", "approvals[]", "notes"]
      : ["plan_only"];

  return planSchema.parse({ objective, steps, expected_outputs });
}

