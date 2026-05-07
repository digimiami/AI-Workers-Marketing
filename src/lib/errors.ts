import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class AppError extends Error {
  status: number;
  code: string;
  context?: Record<string, unknown>;

  constructor(code: string, message: string, status = 500, context?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.context = context;
  }
}

export function friendlyErrorMessage(e: unknown) {
  if (e instanceof AppError) return e.message;
  if (e instanceof Error) return e.message || "Unexpected error";
  return "Unexpected error";
}

export async function logError(input: {
  organizationId?: string | null;
  userId?: string | null;
  campaignId?: string | null;
  level?: "debug" | "info" | "warn" | "error";
  category: "api" | "job" | "ai" | "ads" | "billing" | "security" | "automation" | "system";
  message: string;
  context?: Record<string, unknown>;
  requestId?: string | null;
  durationMs?: number | null;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("logs" as never).insert({
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      campaign_id: input.campaignId ?? null,
      level: input.level ?? "error",
      category: input.category,
      message: input.message,
      context: input.context ?? {},
      request_id: input.requestId ?? null,
      duration_ms: input.durationMs ?? null,
    } as never);
  } catch {
    // Logging must never break the user request.
  }
}

export async function apiErrorResponse(e: unknown, context?: {
  organizationId?: string | null;
  userId?: string | null;
  campaignId?: string | null;
  category?: "api" | "job" | "ai" | "ads" | "billing" | "security" | "automation" | "system";
  requestId?: string | null;
  durationMs?: number | null;
}) {
  const status = e instanceof AppError ? e.status : 500;
  const code = e instanceof AppError ? e.code : "INTERNAL_ERROR";
  const message = friendlyErrorMessage(e);
  await logError({
    organizationId: context?.organizationId,
    userId: context?.userId,
    campaignId: context?.campaignId,
    category: context?.category ?? "api",
    message,
    context: {
      code,
      error_name: e instanceof Error ? e.name : typeof e,
      stack: e instanceof Error ? e.stack?.slice(0, 4000) : undefined,
    },
    requestId: context?.requestId,
    durationMs: context?.durationMs,
  });
  return NextResponse.json({ ok: false, code, message }, { status });
}

