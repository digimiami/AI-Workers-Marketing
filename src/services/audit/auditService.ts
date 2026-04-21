import { env } from "@/lib/env";
import { err, ok, type Result } from "@/lib/result";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@supabase/supabase-js";

export type AuditAction =
  | "campaign.created"
  | "campaign.updated"
  | "funnel.updated"
  | "lead.captured"
  | "lead.updated"
  | "lead.deleted"
  | "affiliate.clicked"
  | "agent.run"
  | "approval.decision"
  | "settings.updated"
  | "email.sent";

export type AuditWriteInput = {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAuditLog(
  input: AuditWriteInput,
): Promise<Result<{ id?: string }, { message: string }>> {
  // Production-ready interface: writes to DB when schema exists.
  // Until migrations are applied locally, gracefully no-op.
  if (!env.server.SUPABASE_SERVICE_ROLE_KEY) {
    // Keep server logs structured even without DB access.
    console.info("[audit]", JSON.stringify(input));
    return ok({});
  }

  try {
    const admin = createClient<Database>(
      env.server.SUPABASE_URL,
      env.server.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin
      // Table will be created in migration t2.
      .from("audit_logs" as any)
      .insert({
        organization_id: input.organizationId ?? null,
        actor_user_id: input.actorUserId ?? null,
        action: input.action,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? null,
      } as any)
      .select("id")
      .single();

    if (error) return err({ message: error.message });
    return ok({ id: (data as any)?.id });
  } catch (e) {
    return err({
      message: e instanceof Error ? e.message : "Failed to write audit log",
    });
  }
}

