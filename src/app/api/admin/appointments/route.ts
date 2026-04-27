import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember, withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createAppointment, logBookingEvent } from "@/services/appointments/appointmentsService";

const querySchema = z.object({ organizationId: z.string().uuid() });

const createSchema = z.object({
  organizationId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  provider: z.enum(["internal", "calendly", "google_calendar"]).default("internal"),
  bookingUrl: z.string().url().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ organizationId: url.searchParams.get("organizationId") });
  if (!parsed.success) return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const { data, error } = await ctx.supabase
    .from("appointments" as never)
    .select(
      "id,status,provider,booking_url,scheduled_at,lead_id,campaign_id,created_at,updated_at,leads(email,full_name),campaigns(name)",
    )
    .eq("organization_id", parsed.data.organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, appointments: data ?? [] });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const appt = await createAppointment(admin as any, {
    organizationId: parsed.data.organizationId,
    campaignId: parsed.data.campaignId ?? null,
    leadId: parsed.data.leadId ?? null,
    provider: parsed.data.provider,
    bookingUrl: parsed.data.bookingUrl ?? null,
    actorUserId: ctx.user.id,
  });

  await logBookingEvent(admin as any, {
    organizationId: parsed.data.organizationId,
    appointmentId: String((appt as any).id),
    leadId: parsed.data.leadId ?? null,
    eventType: "appointment.created",
    message: "Appointment created",
  });

  return NextResponse.json({ ok: true, appointment: appt });
}

