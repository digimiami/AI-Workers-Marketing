import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";

const createBody = z.object({
  organizationId: z.string().uuid(),
  delay_minutes: z.number().int().min(0).default(0),
  template_id: z.string().uuid().nullable().optional(),
});

export async function GET(
  request: Request,
  ctx: { params: Promise<{ sequenceId: string }> },
) {
  const { sequenceId } = await ctx.params;
  if (!z.string().uuid().safeParse(sequenceId).success) {
    return NextResponse.json({ ok: false, message: "Invalid sequenceId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsedOrg = z.string().uuid().safeParse(organizationId);
  if (!parsedOrg.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctxOrg = await withOrgMember(parsedOrg.data);
  if (ctxOrg.error) return ctxOrg.error;

  const { data, error } = await ctxOrg.supabase
    .from("email_sequence_steps" as never)
    .select("id,sequence_id,step_index,delay_minutes,template_id,created_at,updated_at,email_templates(name)")
    .eq("organization_id", parsedOrg.data)
    .eq("sequence_id", sequenceId)
    .order("step_index", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = (data ?? []) as {
    id: string;
    sequence_id: string;
    step_index: number;
    delay_minutes: number;
    template_id: string | null;
    created_at: string;
    updated_at: string;
    email_templates: { name: string } | null;
  }[];

  const steps = rows.map((r) => ({
    id: r.id,
    sequence_id: r.sequence_id,
    step_index: r.step_index,
    delay_minutes: r.delay_minutes,
    template_id: r.template_id,
    template_name: r.email_templates?.name ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return NextResponse.json({ ok: true, steps });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ sequenceId: string }> },
) {
  const { sequenceId } = await ctx.params;
  if (!z.string().uuid().safeParse(sequenceId).success) {
    return NextResponse.json({ ok: false, message: "Invalid sequenceId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const { data: existing, error: existingError } = await op.supabase
    .from("email_sequence_steps" as never)
    .select("step_index")
    .eq("organization_id", parsed.data.organizationId)
    .eq("sequence_id", sequenceId)
    .order("step_index", { ascending: false })
    .limit(1);

  if (existingError) {
    return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 });
  }

  const lastIndex = (existing?.[0] as { step_index: number } | undefined)?.step_index ?? -1;
  const step_index = lastIndex + 1;

  const { data, error } = await op.supabase
    .from("email_sequence_steps" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      sequence_id: sequenceId,
      step_index,
      delay_minutes: parsed.data.delay_minutes,
      template_id: parsed.data.template_id ?? null,
    } as never)
    .select("id,sequence_id,step_index,delay_minutes,template_id,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, step: data });
}

