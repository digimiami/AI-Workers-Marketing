import { NextResponse } from "next/server";

import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";
import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

/**
 * Admin-only manual tool runner for debugging.
 * Uses the logged-in user's session; does NOT require API keys.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const organizationId = (json as any)?.organization_id ?? (json as any)?.organizationId ?? null;
  if (typeof organizationId !== "string") {
    return NextResponse.json({ success: false, trace_id: "trace_invalid", error: { code: "VALIDATION_ERROR", message: "organization_id required" } }, { status: 400 });
  }

  const ctx = await withOrgOperator(organizationId);
  if (ctx.error) return ctx.error;

  // Bind actor context to the current user if not provided
  const patched = {
    ...(json ?? {}),
    organization_id: organizationId,
    actor: (json as any)?.actor ?? { type: "user", user_id: ctx.user.id },
  };

  const result = await executeOpenClawTool(patched);
  const status =
    result.success ? 200 : result.error.code === "VALIDATION_ERROR" ? 400 : result.error.code === "UNAUTHORIZED" ? 401 : result.error.code === "FORBIDDEN" ? 403 : result.error.code === "APPROVAL_REQUIRED" ? 409 : 500;
  return NextResponse.json(result, { status });
}

