import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { writeAuditLog } from "@/services/audit/auditService";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  funnel_id: z.string().uuid(),
  ordered_step_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  // Ensure all steps belong to this funnel/org.
  const { data: steps, error } = await op.supabase
    .from("funnel_steps" as never)
    .select("id")
    .eq("organization_id", parsed.data.organizationId)
    .eq("funnel_id", parsed.data.funnel_id)
    .in("id", parsed.data.ordered_step_ids)
    .limit(600);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const found = new Set((steps ?? []).map((s: any) => s.id as string));
  const missing = parsed.data.ordered_step_ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, message: "One or more steps not found" }, { status: 404 });
  }

  // Update step_index according to provided order.
  await Promise.all(
    parsed.data.ordered_step_ids.map((id, idx) =>
      op.supabase
        .from("funnel_steps" as never)
        .update({ step_index: idx, updated_at: new Date().toISOString() } as never)
        .eq("id", id)
        .eq("organization_id", parsed.data.organizationId),
    ),
  );

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: op.user.id,
    action: "funnel.updated",
    entityType: "funnel",
    entityId: parsed.data.funnel_id,
    metadata: { op: "reorder_steps", count: parsed.data.ordered_step_ids.length },
  });

  return NextResponse.json({ ok: true });
}

