import { NextResponse } from "next/server";
import { after } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runAiGrowthEngine } from "@/services/growth/growthEngine";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  orgId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  url: z.string().url(),
  goal: z.string().min(2),
  audience: z.string().min(2),
  trafficSource: z.string().min(2),
  budget: z.number().min(1).max(100000).default(25),
  provider: z.enum(["openclaw", "internal_llm", "hybrid"]).default("hybrid"),
  adsProviderMode: z.enum(["stub", "live"]).default("stub"),
  approvalMode: z.enum(["required", "auto_draft"]).default("required"),
  mode: z.enum(["affiliate", "client"]).optional(),
  async: z.boolean().optional().default(true),
  defer: z.boolean().optional(),
});

async function markCampaignGrowthStatus(params: {
  organizationId: string;
  campaignId: string;
  status: "building" | "failed";
  error?: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("campaigns" as never)
    .select("metadata")
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .maybeSingle();
  const prevMeta = asMetadataRecord((row as { metadata?: unknown } | null)?.metadata);
  const patch =
    params.status === "building"
      ? { growth_engine: { status: "building", started_at: new Date().toISOString() } }
      : {
          growth_engine: {
            status: "failed",
            failed_at: new Date().toISOString(),
            error: params.error ?? "Growth engine failed",
          },
        };
  await admin
    .from("campaigns" as never)
    .update({ metadata: mergeJsonbRecords(prevMeta, patch), updated_at: new Date().toISOString() } as never)
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId);
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });

  const organizationId = parsed.data.orgId ?? parsed.data.organizationId;
  const orgCtx = await withOrgOperator(organizationId);
  if (orgCtx.error) return orgCtx.error;

  const engineInput = {
    orgId: organizationId,
    userId: parsed.data.userId ?? orgCtx.user.id,
    campaignId: parsed.data.campaignId ?? null,
    url: parsed.data.url,
    goal: parsed.data.goal,
    audience: parsed.data.audience,
    trafficSource: parsed.data.trafficSource,
    budget: parsed.data.budget,
    provider: parsed.data.provider,
    adsProviderMode: parsed.data.adsProviderMode,
    approvalMode: parsed.data.approvalMode,
    mode: parsed.data.mode,
  };

  const deferred = Boolean(parsed.data.defer) && Boolean(parsed.data.async);
  if (deferred) {
    if (parsed.data.campaignId) {
      try {
        await markCampaignGrowthStatus({
          organizationId,
          campaignId: parsed.data.campaignId,
          status: "building",
        });
      } catch (e) {
        console.error("[growth/run] failed to mark campaign building", e);
      }
    }

    after(async () => {
      try {
        await runAiGrowthEngine({
          supabase: orgCtx.supabase,
          actorUserId: orgCtx.user.id,
          input: engineInput,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Growth engine failed";
        console.error("[growth/run] deferred execution failed", e);
        if (parsed.data.campaignId) {
          try {
            await markCampaignGrowthStatus({
              organizationId,
              campaignId: parsed.data.campaignId,
              status: "failed",
              error: msg,
            });
          } catch (markErr) {
            console.error("[growth/run] failed to mark campaign failed", markErr);
          }
        }
      }
    });

    return NextResponse.json({
      ok: true,
      async: true,
      deferred: true,
      queued: true,
      campaignId: parsed.data.campaignId ?? null,
      message: "Growth engine queued — building in the background.",
    });
  }

  try {
    const out = await runAiGrowthEngine({
      supabase: orgCtx.supabase,
      actorUserId: orgCtx.user.id,
      input: engineInput,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Growth engine failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
