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

const createBody = z.object({
  organizationId: z.string().uuid(),
  funnel_id: z.string().uuid(),
  name: z.string().min(1),
  step_type: stepType,
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use kebab-case, e.g. 'bridge-page'"),
  is_public: z.boolean().optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const op = await withOrgOperator(parsed.data.organizationId);
  if (op.error) return op.error;

  // Find next step_index for this funnel.
  const { data: last, error: lastError } = await op.supabase
    .from("funnel_steps" as never)
    .select("step_index")
    .eq("organization_id", parsed.data.organizationId)
    .eq("funnel_id", parsed.data.funnel_id)
    .order("step_index", { ascending: false })
    .limit(1);

  if (lastError) return NextResponse.json({ ok: false, message: lastError.message }, { status: 500 });

  const lastIndex = (last?.[0] as { step_index: number } | undefined)?.step_index ?? -1;
  const step_index = lastIndex + 1;

  const { data, error } = await op.supabase
    .from("funnel_steps" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      funnel_id: parsed.data.funnel_id,
      step_index,
      name: parsed.data.name,
      step_type: parsed.data.step_type,
      slug: parsed.data.slug,
      is_public: parsed.data.is_public ?? true,
    } as never)
    .select("id,funnel_id,step_index,name,step_type,slug,is_public,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: op.user.id,
    action: "funnel.updated",
    entityType: "funnel_step",
    entityId: (data as any)?.id,
    metadata: { funnel_id: parsed.data.funnel_id, op: "create_step" },
  });

  return NextResponse.json({ ok: true, step: data });
}

