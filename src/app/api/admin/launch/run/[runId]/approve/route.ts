import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  section: z.string().min(1).max(40),
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
  const { data: out } = await admin
    .from("agent_outputs" as never)
    .select("content")
    .eq("organization_id", parsed.data.organizationId)
    .eq("run_id", parsedRun.data)
    .eq("output_type", "launch.review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const content = ((out as any)?.content ?? null) as any;
  if (!content) {
    return NextResponse.json({ ok: false, message: "No review model found" }, { status: 404 });
  }

  const approvals = (content.approvals ?? {}) as Record<string, boolean>;
  approvals[parsed.data.section] = true;

  const next = { ...content, approvals };

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
    message: `Section approved: ${parsed.data.section}`,
    data: { section: parsed.data.section },
  } as never);

  return NextResponse.json({ ok: true });
}

