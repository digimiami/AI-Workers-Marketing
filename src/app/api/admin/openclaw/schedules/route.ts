import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { isValidCronExpression } from "@/lib/cron/nextRun";
import { listSchedules, upsertSchedule } from "@/services/openclaw/orchestrationService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data);
  if (ctx.error) return ctx.error;

  const schedules = await listSchedules(ctx.supabase, parsed.data);
  return NextResponse.json({ ok: true, schedules });
}

const postSchema = z.object({
  organizationId: z.string().uuid(),
  id: z.string().uuid().optional(),
  agent_id: z.string().uuid(),
  campaign_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  cron_expression: z.string().min(1),
  timezone: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  next_run_at: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const tz = parsed.data.timezone ?? "UTC";
  if (!isValidCronExpression(parsed.data.cron_expression, tz)) {
    return NextResponse.json(
      { ok: false, message: "Invalid cron_expression or timezone for schedule" },
      { status: 400 },
    );
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const row = await upsertSchedule(ctx.supabase, {
    id: parsed.data.id,
    organization_id: parsed.data.organizationId,
    agent_id: parsed.data.agent_id,
    campaign_id: parsed.data.campaign_id ?? null,
    name: parsed.data.name,
    cron_expression: parsed.data.cron_expression,
    timezone: parsed.data.timezone,
    payload: parsed.data.payload,
    enabled: parsed.data.enabled,
    next_run_at: parsed.data.next_run_at ?? null,
  });

  return NextResponse.json({ ok: true, schedule: row });
}
