import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";

const bearerSchema = z
  .string()
  .regex(/^Bearer\s+.+$/i, "Invalid authorization header")
  .transform((s) => s.replace(/^Bearer\s+/i, "").trim());

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const parsedBearer = bearerSchema.safeParse(auth);
  if (!parsedBearer.success) {
    return NextResponse.json({ success: false, trace_id: "trace_unauth", error: { code: "UNAUTHORIZED", message: "Missing token" } }, { status: 401 });
  }

  const expected = env.server.OPENCLAW_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { success: false, trace_id: "trace_unconfigured", error: { code: "INTERNAL_ERROR", message: "Tool endpoint not configured" } },
      { status: 503 },
    );
  }

  if (parsedBearer.data !== expected) {
    return NextResponse.json(
      { success: false, trace_id: "trace_unauth", error: { code: "UNAUTHORIZED", message: "Invalid token" } },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const result = await executeOpenClawTool(json);

  const status =
    result.success ? 200 : result.error.code === "VALIDATION_ERROR" ? 400 : result.error.code === "UNAUTHORIZED" ? 401 : result.error.code === "FORBIDDEN" ? 403 : result.error.code === "APPROVAL_REQUIRED" ? 409 : 500;

  return NextResponse.json(result, { status });
}

