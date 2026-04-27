import crypto from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";

import { env } from "@/lib/env";
import { writeAuditLog } from "@/services/audit/auditService";
import { renderEmailMarkdown } from "@/services/email/templateRender";
import { signOAuthState, verifyOAuthState } from "@/services/oauth/oauthState";

type Db = SupabaseClient;

function computeBackoffMinutes(attempt: number) {
  // 5m, 10m, 20m, 40m, 80m ... capped at 24h
  const mins = Math.min(5 * Math.pow(2, Math.max(0, attempt - 1)), 24 * 60);
  return Math.round(mins);
}

function buildUnsubscribeToken(params: { organizationId: string; email: string; leadId: string | null }) {
  // Reuse signed state envelope format to avoid introducing a new signing system.
  return signOAuthState({
    organizationId: params.organizationId,
    userId: params.leadId ?? "lead",
    returnTo: "/email/unsubscribed",
    nonce: `${params.email}:${Date.now()}`,
  });
}

export function parseUnsubscribeToken(token: string) {
  const v = verifyOAuthState(token);
  if (!v) return null;
  const [email] = String(v.nonce ?? "").split(":", 1);
  if (!email || !email.includes("@")) return null;
  return { organizationId: v.organizationId, email, leadId: v.userId === "lead" ? null : v.userId };
}

async function isUnsubscribed(db: Db, organizationId: string, email: string) {
  const { data } = await db
    .from("email_unsubscribes" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return Boolean((data as any)?.id);
}

export async function processDueEmailOutbox(
  db: Db,
  opts: { organizationId?: string; actorUserId?: string; limit?: number },
) {
  const limit = opts.limit ?? 25;

  // Pick due queued rows. We keep it simple and lock rows in-app.
  let q = db
    .from("email_logs" as never)
    .select("id,organization_id,lead_id,sequence_id,sequence_step_id,to_email,subject,status,attempt_count,next_attempt_at")
    .eq("status", "queued")
    .lte("next_attempt_at", new Date().toISOString())
    .is("locked_at", null)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const lockId = crypto.randomBytes(8).toString("hex");
  const nowIso = new Date().toISOString();

  // Lock rows (best effort)
  const ids = (rows ?? []).map((r: any) => String(r.id));
  if (ids.length === 0) return { processed: 0, sent: 0, failed: 0, skipped_unsub: 0 };

  await db
    .from("email_logs" as never)
    .update({ locked_at: nowIso, locked_by: lockId } as never)
    .in("id", ids);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped_unsub = 0;

  const resendApiKey = env.server.RESEND_API_KEY;
  const fromEmail = env.server.RESEND_FROM_EMAIL;
  const appBase = env.server.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  const canSend = Boolean(resendApiKey && fromEmail);
  const resend = canSend ? new Resend(resendApiKey) : null;

  for (const r of rows ?? []) {
    processed += 1;
    const id = String((r as any).id);
    const organizationId = String((r as any).organization_id);
    const leadId = (r as any).lead_id ? String((r as any).lead_id) : null;
    const email = String((r as any).to_email ?? "").toLowerCase();
    const attempt = Number((r as any).attempt_count ?? 0) + 1;

    try {
      // Approval gating via metadata: if explicitly gated, skip until ungated.
      const { data: gateRow } = await db
        .from("email_logs" as never)
        .select("metadata")
        .eq("organization_id", organizationId)
        .eq("id", id)
        .maybeSingle();
      const meta = ((gateRow as any)?.metadata ?? {}) as Record<string, unknown>;
      if (meta.gated === true) {
        await db
          .from("email_logs" as never)
          .update({ locked_at: null, locked_by: null } as never)
          .eq("organization_id", organizationId)
          .eq("id", id);
        continue;
      }

      if (await isUnsubscribed(db, organizationId, email)) {
        skipped_unsub += 1;
        await db
          .from("email_logs" as never)
          .update({
            status: "failed",
            error_message: "Unsubscribed",
            attempt_count: attempt,
            last_attempt_at: nowIso,
            next_attempt_at: null,
            locked_at: null,
            locked_by: null,
          } as never)
          .eq("id", id)
          .eq("organization_id", organizationId);
        continue;
      }

      // Support two kinds of outbox rows:
      // - sequence-driven (sequence_step_id)
      // - one-off direct body_markdown stored in email_logs.metadata.body_markdown
      const stepId = (r as any).sequence_step_id ? String((r as any).sequence_step_id) : null;
      const { data: tpl, error: tplErr } = stepId
        ? await db
            .from("email_sequence_steps" as never)
            .select("id,email_templates(subject,body_markdown)")
            .eq("organization_id", organizationId)
            .eq("id", stepId)
            .maybeSingle()
        : ({ data: null, error: null } as any);
      if (tplErr) throw new Error(tplErr.message);

      const { data: lead } = leadId
        ? await db
            .from("leads" as never)
            .select("email,full_name")
            .eq("organization_id", organizationId)
            .eq("id", leadId)
            .maybeSingle()
        : { data: { email, full_name: null } as any };

      const unsubToken = buildUnsubscribeToken({ organizationId, email, leadId });
      const unsubscribeUrl = appBase ? `${appBase}/api/email/unsubscribe?token=${encodeURIComponent(unsubToken)}` : "";

      const directBody =
        typeof (meta as any)?.body_markdown === "string" ? String((meta as any).body_markdown) : "";
      const subject = (tpl ? (((tpl as any).email_templates as any)?.subject as string | undefined) : undefined) ?? String((r as any).subject ?? "(no subject)");
      const bodyMarkdown = (tpl ? (((tpl as any).email_templates as any)?.body_markdown as string | undefined) : undefined) ?? directBody;
      if (!bodyMarkdown) throw new Error("Missing email body");
      const rendered = renderEmailMarkdown(bodyMarkdown, {
        lead: { email, full_name: (lead as any)?.full_name ?? null },
        unsubscribeUrl,
      });

      let provider_message_id: string | null = null;
      if (resend) {
        const sendRes = await resend.emails.send({
          from: fromEmail as string,
          to: email,
          subject,
          text: rendered,
        });
        provider_message_id = (sendRes as any)?.data?.id ?? null;
        if ((sendRes as any)?.error) throw new Error(String((sendRes as any).error?.message ?? "Resend error"));
      } else {
        provider_message_id = `stub_${Date.now()}`;
      }

      await db
        .from("email_logs" as never)
        .update({
          status: "sent",
          provider: "resend",
          provider_message_id,
          error_message: null,
          attempt_count: attempt,
          last_attempt_at: nowIso,
          next_attempt_at: null,
          locked_at: null,
          locked_by: null,
          metadata: { ...meta, provider_mode: resend ? "live" : "stub", unsubscribe_url: unsubscribeUrl, gated: false },
        } as never)
        .eq("id", id)
        .eq("organization_id", organizationId);

      await db.from("analytics_events" as never).insert({
        organization_id: organizationId,
        event_name: "email_sent",
        source: resend ? "resend" : "stub",
        campaign_id: null,
        lead_id: leadId,
        metadata: { email_log_id: id, provider_message_id },
      } as never);

      if (opts.actorUserId) {
        await writeAuditLog({
          organizationId,
          actorUserId: opts.actorUserId,
          action: "email.sent",
          entityType: "email_log",
          entityId: id,
          metadata: { to: email, provider_message_id },
        });
      }

      sent += 1;
    } catch (e) {
      const organizationId = String((r as any).organization_id);
      const nextMins = computeBackoffMinutes(attempt);
      const next = new Date(Date.now() + nextMins * 60_000).toISOString();

      await db
        .from("email_logs" as never)
        .update({
          status: "queued",
          error_message: e instanceof Error ? e.message : "Send failed",
          attempt_count: attempt,
          last_attempt_at: nowIso,
          next_attempt_at: next,
          locked_at: null,
          locked_by: null,
        } as never)
        .eq("id", String((r as any).id))
        .eq("organization_id", organizationId);

      await db.from("analytics_events" as never).insert({
        organization_id: organizationId,
        event_name: "email_send_failed",
        source: "email.outbox",
        campaign_id: null,
        lead_id: (r as any).lead_id ?? null,
        metadata: { email_log_id: String((r as any).id), attempt },
      } as never);

      failed += 1;
    }
  }

  return { processed, sent, failed, skipped_unsub };
}

