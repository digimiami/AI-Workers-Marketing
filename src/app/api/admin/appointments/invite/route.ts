import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logBookingEvent } from "@/services/appointments/appointmentsService";
import { writeAuditLog } from "@/services/audit/auditService";

const bodySchema = z
  .object({
    organizationId: z.string().uuid(),
    appointmentId: z.string().uuid(),
    leadId: z.string().uuid().optional(),
    toEmail: z.string().email().optional(),
    subject: z.string().min(1).max(200),
    bodyMarkdown: z.string().min(1),
    approvalMode: z.enum(["auto", "enforced", "disabled"]).default("enforced"),
  })
  .refine((v) => Boolean(v.toEmail) || Boolean(v.leadId), {
    message: "Provide toEmail or leadId",
    path: ["toEmail"],
  });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();

  const { data: apptRow, error: apptErr } = await admin
    .from("appointments" as never)
    .select("id,organization_id,lead_id")
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", parsed.data.appointmentId)
    .maybeSingle();
  if (apptErr || !apptRow) {
    return NextResponse.json({ ok: false, message: apptErr?.message ?? "Appointment not found" }, { status: 404 });
  }

  let resolvedEmail = parsed.data.toEmail?.trim().toLowerCase() ?? null;
  let resolvedLeadId: string | null = parsed.data.leadId ?? null;

  if (resolvedLeadId && parsed.data.toEmail) {
    const { data: leadCheck, error: leadCheckErr } = await admin
      .from("leads" as never)
      .select("email")
      .eq("organization_id", parsed.data.organizationId)
      .eq("id", resolvedLeadId)
      .maybeSingle();
    if (leadCheckErr || !leadCheck) {
      return NextResponse.json({ ok: false, message: "Lead not found" }, { status: 400 });
    }
    const em = String((leadCheck as any).email ?? "")
      .trim()
      .toLowerCase();
    if (em && em !== resolvedEmail) {
      return NextResponse.json({ ok: false, message: "toEmail does not match leadId" }, { status: 400 });
    }
  }

  if (resolvedLeadId && !resolvedEmail) {
    const { data: leadRow, error: leadErr } = await admin
      .from("leads" as never)
      .select("id,email")
      .eq("organization_id", parsed.data.organizationId)
      .eq("id", resolvedLeadId)
      .maybeSingle();
    if (leadErr || !leadRow || !(leadRow as any).email) {
      return NextResponse.json({ ok: false, message: "Lead not found or missing email" }, { status: 400 });
    }
    resolvedEmail = String((leadRow as any).email).trim().toLowerCase();
  }
  if (!resolvedEmail) {
    return NextResponse.json({ ok: false, message: "Could not resolve recipient email" }, { status: 400 });
  }

  const apptLeadId = (apptRow as any).lead_id ? String((apptRow as any).lead_id) : null;
  if (apptLeadId && resolvedLeadId && apptLeadId !== resolvedLeadId) {
    return NextResponse.json(
      { ok: false, message: "leadId does not match appointment.lead_id" },
      { status: 400 },
    );
  }
  if (apptLeadId && !resolvedLeadId) {
    resolvedLeadId = apptLeadId;
    const { data: leadRow2 } = await admin
      .from("leads" as never)
      .select("email")
      .eq("organization_id", parsed.data.organizationId)
      .eq("id", apptLeadId)
      .maybeSingle();
    const expected = String((leadRow2 as any)?.email ?? "")
      .trim()
      .toLowerCase();
    if (expected && expected !== resolvedEmail) {
      return NextResponse.json(
        { ok: false, message: "toEmail does not match the lead on this appointment" },
        { status: 400 },
      );
    }
  }

  // Create an outbox row (gated by default unless approvalMode=disabled/auto).
  const gated = parsed.data.approvalMode !== "disabled";
  const now = new Date().toISOString();
  const farFuture = new Date(Date.now() + 1000 * 86400_000).toISOString(); // ~1000 days
  const nextAttempt = gated ? farFuture : now;

  const { data: emailLog, error } = await admin
    .from("email_logs" as never)
    .insert({
      organization_id: parsed.data.organizationId,
      lead_id: resolvedLeadId,
      sequence_id: null,
      sequence_step_id: null,
      to_email: resolvedEmail,
      subject: parsed.data.subject,
      provider: "resend",
      status: "queued",
      scheduled_for: now,
      next_attempt_at: nextAttempt,
      metadata: { kind: "appointment_invite", appointment_id: parsed.data.appointmentId, gated },
    } as never)
    .select("id")
    .single();
  if (error || !emailLog) return NextResponse.json({ ok: false, message: error?.message ?? "Failed to queue invite" }, { status: 500 });

  // Store body as a one-off template in metadata (outbox renders from sequence templates; we keep it text-only for invites).
  await admin
    .from("email_logs" as never)
    .update({ metadata: { kind: "appointment_invite", appointment_id: parsed.data.appointmentId, gated, body_markdown: parsed.data.bodyMarkdown } } as never)
    .eq("organization_id", parsed.data.organizationId)
    .eq("id", (emailLog as any).id);

  if (gated && parsed.data.approvalMode === "enforced") {
    const { data: approval, error: aErr } = await admin
      .from("approvals" as never)
      .insert({
        organization_id: parsed.data.organizationId,
        campaign_id: null,
        status: "pending",
        approval_type: "appointment_invite",
        reason_required: false,
        requested_by_user_id: ctx.user.id,
        target_entity_type: "email_log",
        target_entity_id: (emailLog as any).id,
        payload: { appointment_id: parsed.data.appointmentId, email_log_id: (emailLog as any).id },
      } as never)
      .select("id")
      .single();
    if (aErr) return NextResponse.json({ ok: false, message: aErr.message }, { status: 500 });

    await logBookingEvent(admin as any, {
      organizationId: parsed.data.organizationId,
      appointmentId: parsed.data.appointmentId,
      eventType: "invite.gated_for_approval",
      message: "Invite queued and gated pending approval",
      metadata: { approval_id: (approval as any).id, email_log_id: (emailLog as any).id },
    });
  } else {
    await logBookingEvent(admin as any, {
      organizationId: parsed.data.organizationId,
      appointmentId: parsed.data.appointmentId,
      eventType: "invite.queued",
      message: "Invite queued",
      metadata: { email_log_id: (emailLog as any).id, gated },
    });
  }

  await writeAuditLog({
    organizationId: parsed.data.organizationId,
    actorUserId: ctx.user.id,
    action: "appointment.invite_queued",
    entityType: "appointment",
    entityId: parsed.data.appointmentId,
    metadata: { op: "invite_queued", email_log_id: (emailLog as any).id, gated },
  });

  return NextResponse.json({ ok: true, email_log_id: (emailLog as any).id, gated });
}

