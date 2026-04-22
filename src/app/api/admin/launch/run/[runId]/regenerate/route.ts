import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  section: z.enum(["campaign", "funnel", "content", "email", "tracking", "review"]),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<unknown> },
) {
  const params = (await ctx.params) as { runId?: unknown };
  const runId = typeof params?.runId === "string" ? params.runId : "";
  const parsedRun = z.string().uuid().safeParse(runId);
  if (!parsedRun.success) {
    return NextResponse.json({ ok: false, message: "Invalid runId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const { data: run } = await admin
    .from("agent_runs" as never)
    .select("id,input,campaign_id,agent_id")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsedRun.data)
    .single();
  if (!run) return NextResponse.json({ ok: false, message: "Run not found" }, { status: 404 });

  const traceId = String((run as any).input?.trace_id ?? "");
  const agentId = String((run as any).agent_id ?? "");
  const campaignId = (run as any).campaign_id as string | null;

  const { data: out } = await admin
    .from("agent_outputs" as never)
    .select("content")
    .eq("organization_id", parsed.data.organizationId)
    .eq("run_id", parsedRun.data)
    .eq("output_type", "launch.review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const current = ((out as any)?.content ?? null) as any;
  if (!current) {
    return NextResponse.json({ ok: false, message: "No review model found" }, { status: 404 });
  }

  const callTool = async (tool_name: string, input: Record<string, unknown>) => {
    const result = await executeOpenClawTool({
      organization_id: parsed.data.organizationId,
      trace_id: traceId,
      role_mode: "campaign_launcher",
      approval_mode: "auto",
      actor: { type: "user", user_id: orgCtx.user.id },
      campaign_id: campaignId,
      agent_id: agentId,
      run_id: parsedRun.data,
      tool_name,
      input,
    });
    if (!result.success) throw new Error(`${tool_name}: ${result.error.code}`);
    return result.data as any;
  };

  const next = { ...current };

  // Keep regenerate lightweight + safe: create new draft records and update the review model to point at them.
  if (parsed.data.section === "content") {
    const created = await callTool("create_content_asset", {
      organizationId: parsed.data.organizationId,
      title: `Content batch (regen) · ${new Date().toISOString()}`.slice(0, 120),
      platform: String((run as any).input?.traffic_source ?? "web"),
      status: "draft",
      campaign_id: campaignId,
      funnel_id: (current.funnel?.id ?? null) as string | null,
      hook: "Regenerated batch",
      body: "New batch draft generated. Review + edit before any publishing.",
      metadata: { trace_id: traceId, kind: "content_batch_regen" },
    });
    next.content_assets = [...(next.content_assets ?? []), { id: created.id, title: created.title, status: created.status }];
  }

  if (parsed.data.section === "email") {
    const tpl = await callTool("create_email_template", {
      organizationId: parsed.data.organizationId,
      name: `Regen email · ${new Date().toISOString()}`.slice(0, 120),
      subject: "Alternative angle (review before sending)",
      body_markdown: "This is a regenerated draft. Review + edit before sending.",
      status: "draft",
    });
    next.email = next.email ?? {};
    next.email.templates = [...(next.email.templates ?? []), { id: tpl.id, name: tpl.name, subject: tpl.subject, status: tpl.status }];
  }

  if (parsed.data.section === "tracking") {
    const link = await callTool("create_tracking_link", {
      organizationId: parsed.data.organizationId,
      destination_url: String((run as any).input?.affiliate_link ?? ""),
      label: `Regen link · ${new Date().toISOString()}`.slice(0, 120),
      campaign_id: campaignId,
      utm_defaults: { utm_source: "regen", utm_campaign: "launcher" },
    });
    next.tracking = { link: { id: link.id, destination_url: link.destination_url } };
  }

  if (parsed.data.section === "review") {
    next.notes = `${String(next.notes ?? "")}\n\n[regen ${new Date().toISOString()}] refreshed notes.`;
  }

  await admin.from("agent_outputs" as never).insert({
    organization_id: parsed.data.organizationId,
    run_id: parsedRun.data,
    output_type: "launch.review",
    content: next,
  } as never);

  await admin.from("agent_logs" as never).insert({
    organization_id: parsed.data.organizationId,
    run_id: parsedRun.data,
    level: "info",
    message: `Section regenerated: ${parsed.data.section}`,
    data: { section: parsed.data.section },
  } as never);

  return NextResponse.json({ ok: true });
}

