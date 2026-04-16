import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { listTemplates, upsertTemplate } from "@/services/openclaw/orchestrationService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const agentId = url.searchParams.get("agentId");
  const pOrg = z.string().uuid().safeParse(organizationId);
  const pAgent = z.string().uuid().safeParse(agentId);
  if (!pOrg.success || !pAgent.success) {
    return NextResponse.json(
      { ok: false, message: "organizationId and agentId required" },
      { status: 400 },
    );
  }

  const ctx = await withOrgMember(pOrg.data);
  if (ctx.error) return ctx.error;

  const templates = await listTemplates(ctx.supabase, pOrg.data, pAgent.data);
  return NextResponse.json({ ok: true, templates });
}

const postSchema = z.object({
  organizationId: z.string().uuid(),
  agentId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  system_prompt: z.string().min(1),
  style_rules: z.string().optional().nullable(),
  forbidden_claims: z.string().optional().nullable(),
  output_format: z.string().optional().nullable(),
  campaign_context: z.string().optional().nullable(),
  is_default: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const tpl = await upsertTemplate(ctx.supabase, parsed.data.organizationId, parsed.data.agentId, {
    id: parsed.data.id,
    name: parsed.data.name,
    system_prompt: parsed.data.system_prompt,
    style_rules: parsed.data.style_rules,
    forbidden_claims: parsed.data.forbidden_claims,
    output_format: parsed.data.output_format,
    campaign_context: parsed.data.campaign_context,
    is_default: parsed.data.is_default,
  });

  return NextResponse.json({ ok: true, template: tpl });
}
