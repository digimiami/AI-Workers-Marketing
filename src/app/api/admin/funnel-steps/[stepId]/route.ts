import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";

const stepType = z.enum([
  "landing",
  "bridge",
  "form",
  "cta",
  "thank_you",
  "email_trigger",
  "other",
]);

const patchBody = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).optional(),
  step_type: stepType.optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use kebab-case, e.g. 'bridge-page'")
    .optional(),
  is_public: z.boolean().optional(),
});

const deleteBody = z.object({
  organizationId: z.string().uuid(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await ctx.params;
  if (!z.string().uuid().safeParse(stepId).success) {
    return NextResponse.json({ ok: false, message: "Invalid stepId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.step_type !== undefined) patch.step_type = parsed.data.step_type;
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.is_public !== undefined) patch.is_public = parsed.data.is_public;

  const { data, error } = await op.supabase
    .from("funnel_steps" as never)
    .update(patch as never)
    .eq("id", stepId)
    .eq("organization_id", parsed.data.organizationId)
    .select("id,funnel_id,step_index,name,step_type,slug,is_public,created_at,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, message: "Step not found" }, { status: 404 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: op.user.id,
    action: "funnel.updated",
    entityType: "funnel_step",
    entityId: (data as any)?.id,
    metadata: { funnel_id: (data as any)?.funnel_id, op: "update_step" },
  });

  return NextResponse.json({ ok: true, step: data });
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ stepId: string }> },
) {
  const { stepId } = await ctx.params;
  if (!z.string().uuid().safeParse(stepId).success) {
    return NextResponse.json({ ok: false, message: "Invalid stepId" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  // Fetch step to reindex remaining steps after delete.
  const { data: step, error: stepError } = await op.supabase
    .from("funnel_steps" as never)
    .select("id,funnel_id,step_index")
    .eq("id", stepId)
    .eq("organization_id", parsed.data.organizationId)
    .maybeSingle();

  if (stepError) return NextResponse.json({ ok: false, message: stepError.message }, { status: 500 });
  if (!step) return NextResponse.json({ ok: false, message: "Step not found" }, { status: 404 });

  const { error: delError } = await op.supabase
    .from("funnel_steps" as never)
    .delete()
    .eq("id", stepId)
    .eq("organization_id", parsed.data.organizationId);

  if (delError) return NextResponse.json({ ok: false, message: delError.message }, { status: 500 });

  // Close the gap in step_index for this funnel.
  const { data: rest, error: restError } = await op.supabase
    .from("funnel_steps" as never)
    .select("id,step_index")
    .eq("organization_id", parsed.data.organizationId)
    .eq("funnel_id", (step as any).funnel_id)
    .order("step_index", { ascending: true })
    .limit(500);

  if (!restError && rest) {
    const updates = (rest as { id: string; step_index: number }[]).map((r, idx) => ({
      id: r.id,
      step_index: idx,
    }));
    if (updates.length > 0) {
      await Promise.all(
        updates.map((u) =>
          op.supabase
            .from("funnel_steps" as never)
            .update({ step_index: u.step_index, updated_at: new Date().toISOString() } as never)
            .eq("id", u.id)
            .eq("organization_id", parsed.data.organizationId),
        ),
      );
    }
  }

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: op.user.id,
    action: "funnel.updated",
    entityType: "funnel_step",
    entityId: stepId,
    metadata: { funnel_id: (step as any).funnel_id, op: "delete_step" },
  });

  return NextResponse.json({ ok: true });
}

