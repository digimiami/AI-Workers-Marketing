import { NextResponse } from "next/server";

import { z } from "zod";

import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  resolveCloudApiTokenBySecret,
  touchCloudApiTokenUsed,
  verifyLegacyOpenClawApiKey,
} from "@/services/cloud/cloudApiTokensService";

const bearerSchema = z
  .string()
  .regex(/^Bearer\s+.+$/i, "Invalid authorization header")
  .transform((s) => s.replace(/^Bearer\s+/i, "").trim());

function jsonErr(trace: string, code: string, message: string, status: number) {
  return NextResponse.json({ success: false, trace_id: trace, error: { code, message } }, { status });
}

/**
 * Shared handler for machine-to-machine OpenClaw tool execution.
 *
 * Auth (in order):
 * 1. Legacy: `Authorization: Bearer` matches `OPENCLAW_API_KEY` (full trust of JSON envelope, including actor).
 * 2. Database: Bearer matches an active `organization_cloud_api_tokens` row; `organization_id` in body must
 *    match the token's org; `actor` is always taken from the token (ignores client-supplied actor).
 */
export async function handleCloudToolsRunPost(request: Request): Promise<Response> {
  const auth = request.headers.get("authorization") ?? "";
  const parsedBearer = bearerSchema.safeParse(auth);
  if (!parsedBearer.success) {
    return jsonErr("trace_unauth", "UNAUTHORIZED", "Missing or invalid Authorization: Bearer header", 401);
  }
  const bearerSecret = parsedBearer.data;

  const json = await request.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return jsonErr("trace_invalid", "VALIDATION_ERROR", "JSON object body required", 400);
  }

  let resolvedBody: Record<string, unknown> = { ...(json as Record<string, unknown>) };

  const legacyOk = verifyLegacyOpenClawApiKey(bearerSecret);
  if (legacyOk) {
    // Envelope unchanged (including actor).
  } else {
    const admin = createSupabaseAdminClient();
    const row = await resolveCloudApiTokenBySecret(admin, bearerSecret);
    if (!row) {
      return jsonErr("trace_unauth", "UNAUTHORIZED", "Invalid or revoked API token", 401);
    }
    const orgId = typeof resolvedBody.organization_id === "string" ? resolvedBody.organization_id : "";
    if (!orgId || orgId !== row.organization_id) {
      return jsonErr(
        "trace_org_mismatch",
        "FORBIDDEN",
        "organization_id must exactly match the API token organization",
        403,
      );
    }
    resolvedBody = {
      ...resolvedBody,
      organization_id: row.organization_id,
      actor: { type: "user", user_id: row.actor_user_id },
    };
    await touchCloudApiTokenUsed(admin, row.id);
  }

  const result = await executeOpenClawTool(resolvedBody);
  const status = result.success
    ? 200
    : result.error.code === "VALIDATION_ERROR"
      ? 400
      : result.error.code === "UNAUTHORIZED"
        ? 401
        : result.error.code === "FORBIDDEN"
          ? 403
          : result.error.code === "APPROVAL_REQUIRED"
            ? 409
            : 500;

  return NextResponse.json(result, { status });
}
