import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";
import { writeAuditLog } from "@/services/audit/auditService";

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  type: z.enum(["affiliate", "lead_gen", "internal_test", "client"]).default("affiliate"),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  targetAudience: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  await requireUser();
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaigns" as any)
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, campaigns: data ?? [] });
}

export async function POST(request: Request) {
  const user = await requireUser();
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaigns" as any)
    .insert({
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      type: parsed.data.type,
      status: parsed.data.status,
      target_audience: parsed.data.targetAudience ?? null,
      description: parsed.data.description ?? null,
    } as any)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: user.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: (data as any)?.id,
    metadata: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true, campaign: data });
}

