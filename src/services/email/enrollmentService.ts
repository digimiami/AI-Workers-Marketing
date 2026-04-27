import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/services/audit/auditService";

type Db = SupabaseClient;

export async function enrollLeadInSequence(
  db: Db,
  params: {
    organizationId: string;
    actorUserId: string | null;
    leadId: string;
    sequenceId: string;
  },
) {
  // 1) Verify lead and sequence belong to org (RLS should enforce, but we want good errors)
  const { data: lead, error: leadErr } = await db
    .from("leads" as never)
    .select("id,email")
    .eq("organization_id", params.organizationId)
    .eq("id", params.leadId)
    .maybeSingle();

  if (leadErr) throw new Error(leadErr.message);
  if (!lead) throw new Error("Lead not found");

  const { data: seq, error: seqErr } = await db
    .from("email_sequences" as never)
    .select("id,is_active")
    .eq("organization_id", params.organizationId)
    .eq("id", params.sequenceId)
    .maybeSingle();

  if (seqErr) throw new Error(seqErr.message);
  if (!seq) throw new Error("Sequence not found");

  // 2) Create enrollment (idempotent)
  const { data: enrollment, error: enrollErr } = await db
    .from("email_enrollments" as never)
    .upsert(
      {
        organization_id: params.organizationId,
        lead_id: params.leadId,
        sequence_id: params.sequenceId,
        status: "active",
      } as never,
      { onConflict: "lead_id,sequence_id" },
    )
    .select("id,lead_id,sequence_id,status,enrolled_at")
    .single();

  if (enrollErr) throw new Error(enrollErr.message);

  // 3) Load steps and templates to queue logs.
  const { data: steps, error: stepsErr } = await db
    .from("email_sequence_steps" as never)
    .select("id,step_index,delay_minutes,template_id,email_templates(subject)")
    .eq("organization_id", params.organizationId)
    .eq("sequence_id", params.sequenceId)
    .order("step_index", { ascending: true })
    .limit(200);

  if (stepsErr) throw new Error(stepsErr.message);

  const missingTemplate = (steps ?? []).find((s: any) => !s.template_id);
  if (missingTemplate) {
    throw new Error("Sequence has steps without templates. Assign templates before enrolling leads.");
  }

  const now = Date.now();
  const queued = (steps ?? []).map((s: any) => {
    const scheduledFor = new Date(now + (Number(s.delay_minutes ?? 0) * 60_000)).toISOString();
    const subject = (s.email_templates as { subject?: string } | null)?.subject ?? "(missing subject)";
    return {
      organization_id: params.organizationId,
      lead_id: params.leadId,
      sequence_id: params.sequenceId,
      sequence_step_id: s.id as string,
      to_email: (lead as any).email as string,
      subject,
      provider: "resend",
      status: "queued",
      scheduled_for: scheduledFor,
      next_attempt_at: scheduledFor,
      metadata: { scheduled_for: scheduledFor, step_index: s.step_index },
    };
  });

  if (queued.length > 0) {
    const { error: logErr } = await db.from("email_logs" as never).insert(queued as never);
    if (logErr) throw new Error(logErr.message);
  }

  if (queued.length > 0) {
    await db.from("analytics_events" as never).insert({
      organization_id: params.organizationId,
      event_name: "email_queued",
      source: "email.enroll",
      campaign_id: null,
      lead_id: params.leadId,
      metadata: { sequence_id: params.sequenceId, queued: queued.length },
    } as never);
  }

  if (params.actorUserId) {
    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "email.enrolled",
      entityType: "email_enrollment",
      entityId: (enrollment as any)?.id,
      metadata: { lead_id: params.leadId, sequence_id: params.sequenceId, queued: queued.length },
    });
  }

  return { enrollment, queuedCount: queued.length };
}

