import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { deleteSchedule, upsertSchedule } from "@/services/openclaw/orchestrationService";

const patchSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  cron_expression: z.string().min(1).optional(),
  timezone: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  next_run_at: z.string().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await ctx.params;
  if (!z.string().uuid().safeParse(scheduleId).success) {
    return NextResponse.json({ ok: false, message: "Invalid scheduleId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const existing = await orgCtx.supabase
    .from("agent_scheduled_tasks")
    .select("*")
    .eq("id", scheduleId)
    .eq("organization_id", parsed.data.organizationId)
    .single();

  if (existing.error || !existing.data) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  const cur = existing.data as Record<string, unknown>;
  const row = await upsertSchedule(orgCtx.supabase, {
    id: scheduleId,
    organization_id: parsed.data.organizationId,
    agent_id: cur.agent_id as string,
    campaign_id:
      parsed.data.campaign_id !== undefined
        ? parsed.data.campaign_id
        : (cur.campaign_id as string | null),
    name: parsed.data.name ?? (cur.name as string),
    cron_expression: parsed.data.cron_expression ?? (cur.cron_expression as string),
    timezone: parsed.data.timezone ?? (cur.timezone as string),
    payload: parsed.data.payload ?? (cur.payload as Record<string, unknown>),
    enabled: parsed.data.enabled ?? (cur.enabled as boolean),
    next_run_at:
      parsed.data.next_run_at !== undefined
        ? parsed.data.next_run_at
        : (cur.next_run_at as string | null),
  });

  return NextResponse.json({ ok: true, schedule: row });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await ctx.params;
  if (!z.string().uuid().safeParse(scheduleId).success) {
    return NextResponse.json({ ok: false, message: "Invalid scheduleId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsedOrg.data);
  if (orgCtx.error) return orgCtx.error;

  await deleteSchedule(orgCtx.supabase, parsedOrg.data, scheduleId);
  return NextResponse.json({ ok: true });
}
