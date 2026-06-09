"use server";

import { z } from "zod";

import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/services/audit/auditService";
import { assertCampaignLimit } from "@/services/billing/entitlements";
import { beginMarketingPipelineRun } from "@/services/marketing-pipeline/runMarketingPipeline";
import { requireUser } from "@/services/auth/authService";
import { isOrgOperator } from "@/services/org/assertOrgAccess";

const launchSchema = z.object({
  url: z.string().url(),
  audience: z.string().min(2),
  goal: z.enum(["leads", "sales", "traffic"]),
});

export type LaunchFirstCampaignResult =
  | { ok: true; campaignId: string; pipelineRunId: string }
  | { ok: false; message: string };

export async function launchFirstCampaignAction(input: {
  url: string;
  audience: string;
  goal: "leads" | "sales" | "traffic";
}): Promise<LaunchFirstCampaignResult> {
  const parsed = launchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid onboarding input." };

  const user = await requireUser();
  const organizationId = await getCurrentOrgIdFromCookie();
  if (!organizationId) {
    return { ok: false, message: "No workspace selected. Finish workspace setup first." };
  }

  const supabase = await createSupabaseServerClient();
  const operator = await isOrgOperator(supabase, organizationId);
  if (!operator) {
    return {
      ok: false,
      message:
        "You need admin or operator access in this workspace to launch a campaign. Switch to your own workspace in the sidebar, or ask an admin to upgrade your role.",
    };
  }

  try {
    await assertCampaignLimit({ organizationId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Plan limit reached";
    return { ok: false, message: msg };
  }

  const { url, audience, goal } = parsed.data;
  const name = `${goal === "leads" ? "Lead Gen" : goal === "sales" ? "Sales" : "Traffic"} · ${new URL(url).hostname}`.slice(0, 80);

  const { data: campaign, error: createErr } = await supabase
    .from("campaigns" as never)
    .insert({
      organization_id: organizationId,
      name,
      type: goal === "sales" ? "client" : "lead_gen",
      status: "draft",
      target_audience: audience,
      description: `Onboarding input\nURL: ${url}\nGoal: ${goal}\nAudience: ${audience}`,
    } as never)
    .select("id")
    .single();

  if (createErr || !campaign) {
    return { ok: false, message: createErr?.message ?? "Campaign create failed" };
  }

  const campaignId = String((campaign as { id: string }).id);

  await writeAuditLog({
    organizationId,
    actorUserId: user.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaignId,
    metadata: { name, source: "onboarding_growth" },
  });

  const goalText =
    goal === "traffic"
      ? "Increase qualified traffic"
      : goal === "sales"
        ? "Drive purchases / revenue"
        : "Generate qualified leads";

  const begin = await beginMarketingPipelineRun({
    supabase,
    actorUserId: user.id,
    input: {
      organizationMode: "existing",
      organizationId,
      campaignId,
      url,
      mode: "client",
      goal: goalText,
      audience,
      trafficSource: "Google Ads",
      provider: "hybrid",
      approvalMode: "auto_draft",
      notes: `Onboarding · budget $25/day`,
    } as never,
  });

  return { ok: true, campaignId, pipelineRunId: begin.pipelineRunId };
}
