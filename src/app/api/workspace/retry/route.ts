import { NextResponse } from "next/server";

import crypto from "crypto";
import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executePendingRun } from "@/services/openclaw/orchestrationService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid(),
  section: z.enum(["content", "email", "funnel", "workers", "approvals"]),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const sectionKey =
    parsed.data.section === "content"
      ? "content_strategist"
      : parsed.data.section === "email"
        ? "lead_nurture_worker"
        : parsed.data.section === "funnel"
          ? "funnel_architect"
          : parsed.data.section === "workers"
            ? "campaign_launcher"
            : "analyst_worker";

  const { data: agent, error: aErr } = await admin
    .from("agents" as never)
    .select("id,key")
    .eq("organization_id", parsed.data.organizationId)
    .eq("key", sectionKey)
    .maybeSingle();
  if (aErr) return NextResponse.json({ ok: false, message: aErr.message }, { status: 500 });
  if (!agent) return NextResponse.json({ ok: false, message: "Worker not found for org" }, { status: 404 });

  const traceId = `trace_${crypto.randomUUID()}`;
  const { data: run, error: rErr } = await admin
    .from("agent_runs" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      agent_id: (agent as any).id,
      campaign_id: parsed.data.campaignId,
      status: "pending",
      input: { trace_id: traceId, purpose: `workspace_retry_${parsed.data.section}`, section: parsed.data.section, stub: true },
    } as never)
    .select("id")
    .single();
  if (rErr || !run) return NextResponse.json({ ok: false, message: rErr?.message ?? "Failed to create retry run" }, { status: 500 });

  await executePendingRun(admin as any, {
    organizationId: parsed.data.organizationId,
    runId: (run as any).id,
    actorUserId: orgCtx.user.id,
  });

  return NextResponse.json({ ok: true });
}

