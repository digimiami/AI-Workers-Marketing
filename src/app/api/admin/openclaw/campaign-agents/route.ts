import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { assignCampaignAgent, listCampaignAgents } from "@/services/openclaw/orchestrationService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const campaignId = url.searchParams.get("campaignId");
  const pOrg = z.string().uuid().safeParse(organizationId);
  const pCamp = z.string().uuid().safeParse(campaignId);
  if (!pOrg.success || !pCamp.success) {
    return NextResponse.json(
      { ok: false, message: "organizationId and campaignId required" },
      { status: 400 },
    );
  }

  const ctx = await withOrgMember(pOrg.data);
  if (ctx.error) return ctx.error;

  const rows = await listCampaignAgents(ctx.supabase, pOrg.data, pCamp.data);
  return NextResponse.json({ ok: true, campaignAgents: rows });
}

const postSchema = z.object({
  organizationId: z.string().uuid(),
  campaign_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  priority: z.number().int().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const row = await assignCampaignAgent(ctx.supabase, {
    organization_id: parsed.data.organizationId,
    campaign_id: parsed.data.campaign_id,
    agent_id: parsed.data.agent_id,
    priority: parsed.data.priority,
    config: parsed.data.config,
  });

  return NextResponse.json({ ok: true, campaignAgent: row });
}
