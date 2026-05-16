import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executePublishFunnel } from "@/services/openclaw/publishFunnelService";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/**
 * Re-run a gated Cloud tool after an operator approves the queue item.
 */
export async function applyDeferredToolAfterApproval(
  admin: AdminClient,
  organizationId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const toolName = typeof payload.tool === "string" ? payload.tool : "";
  const toolInput = asRecord(payload.input);

  if (!toolName || !toolInput.organizationId) {
    if (toolInput.organizationId === undefined && organizationId) {
      toolInput.organizationId = organizationId;
    }
  }

  if (toolName === "publish_funnel") {
    const campaignId = String(toolInput.campaign_id ?? "");
    if (!campaignId) return null;
    const result = await executePublishFunnel(admin, {
      organizationId,
      campaign_id: campaignId,
      funnel_id: typeof toolInput.funnel_id === "string" ? toolInput.funnel_id : null,
      variant_id: typeof toolInput.variant_id === "string" ? toolInput.variant_id : null,
      activate_campaign: toolInput.activate_campaign !== false,
    });
    return { deferred_tool_applied: toolName, ...result };
  }

  if (toolName === "activate_email_sequence") {
    const sequenceId = String(toolInput.sequence_id ?? "");
    if (!sequenceId) return null;
    const isActive = toolInput.is_active !== false;
    await admin
      .from("email_sequences" as never)
      .update({ is_active: isActive, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("id", sequenceId);
    return { deferred_tool_applied: toolName, ok: true, sequence_id: sequenceId, is_active: isActive };
  }

  if (toolName === "change_content_status") {
    const contentAssetId = String(toolInput.content_asset_id ?? "");
    const status = String(toolInput.status ?? "");
    if (!contentAssetId || !status) return null;
    await admin
      .from("content_assets" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("id", contentAssetId);
    return { deferred_tool_applied: toolName, ok: true, content_asset_id: contentAssetId, status };
  }

  return null;
}
