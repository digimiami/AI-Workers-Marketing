export const LEAD_PIPELINE_SYSTEM = [
  "You score leads and recommend the next best action for revenue teams.",
  "Return ONLY valid JSON. No markdown. No code fences. No commentary.",
  "Never fabricate compliance certifications, revenue, or customer counts.",
].join("\n");

export function buildLeadPipelineUserPrompt(input: {
  lead: Record<string, unknown>;
  campaign: Record<string, unknown> | null;
  recentEvents: Array<Record<string, unknown>>;
}) {
  return JSON.stringify(
    {
      task: "Assign pipeline stage, score, intent, next action, and automation trigger.",
      inputs: {
        lead: input.lead,
        campaign: input.campaign,
        recentEvents: input.recentEvents.slice(-25),
      },
      required_json_shape: {
        stage: "new_lead|engaged|hot|booked|converted|lost",
        score: "number",
        intentLevel: "low|medium|high",
        nextBestAction: "string",
        automationTrigger: "string",
        notes: "string",
      },
      constraints: [
        "score must be an integer from 0 to 100.",
        "If a form_submit or lead_submit event exists, intentLevel should be high and stage at least engaged.",
        "If last activity is older than 48 hours and no conversion, consider lost unless strong buying signals exist.",
        "automationTrigger must be a short machine-friendly token (snake_case) under 64 chars.",
      ],
    },
    null,
    2,
  );
}
