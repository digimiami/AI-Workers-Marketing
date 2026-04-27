import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAuditLog } from "@/services/audit/auditService";
import { createCalendarProvider } from "@/services/appointments/calendarProviders";

type Db = SupabaseClient;

export async function createAppointment(
  db: Db,
  params: {
    organizationId: string;
    campaignId?: string | null;
    leadId?: string | null;
    provider: "internal" | "calendly" | "google_calendar";
    bookingUrl?: string | null;
    ownerUserId?: string | null;
    metadata?: Record<string, unknown>;
    actorUserId?: string | null;
  },
) {
  if (params.bookingUrl) {
    const cal = createCalendarProvider(params.provider);
    await cal.resolveBookingLink({
      organizationId: params.organizationId,
      bookingUrl: params.bookingUrl,
    });
  }

  const { data, error } = await db
    .from("appointments" as never)
    .insert({
      organization_id: params.organizationId,
      campaign_id: params.campaignId ?? null,
      lead_id: params.leadId ?? null,
      provider: params.provider,
      booking_url: params.bookingUrl ?? null,
      owner_user_id: params.ownerUserId ?? null,
      status: "pending",
      metadata: params.metadata ?? {},
      updated_at: new Date().toISOString(),
    } as never)
    .select("id,status,booking_url,created_at")
    .single();
  if (error) throw new Error(error.message);

  if (params.actorUserId) {
    await writeAuditLog({
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      action: "appointment.created",
      entityType: "appointment",
      entityId: String((data as any).id),
      metadata: { op: "create", lead_id: params.leadId ?? null, provider: params.provider },
    });
  }

  return data as any;
}

export async function logBookingEvent(
  db: Db,
  params: {
    organizationId: string;
    appointmentId: string;
    leadId?: string | null;
    eventType: string;
    message?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await db.from("booking_logs" as never).insert({
    organization_id: params.organizationId,
    appointment_id: params.appointmentId,
    lead_id: params.leadId ?? null,
    event_type: params.eventType,
    message: params.message ?? null,
    metadata: params.metadata ?? {},
  } as never);
  if (error) throw new Error(error.message);
}

