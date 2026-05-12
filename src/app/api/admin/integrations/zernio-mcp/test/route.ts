import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { zernioListTools } from "@/services/zernio/zernioMcp";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
});

/**
 * Verifies Zernio MCP connectivity (listTools). Operators only.
 */
export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  try {
    const res = await zernioListTools();
    const tools = Array.isArray((res as { tools?: unknown }).tools)
      ? ((res as { tools: unknown[] }).tools as unknown[])
      : [];
    return NextResponse.json({
      ok: true,
      toolCount: tools.length,
      message: tools.length ? `Connected — ${tools.length} tools reported.` : "Connected — no tools in response (check Zernio account).",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("ZERNIO_MCP_NOT_CONFIGURED") ? 503 : 502;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 503
            ? "Zernio MCP is not configured. Set ZERNIO_MCP_API_KEY (and optionally ZERNIO_MCP_SERVER_URL) in Vercel environment variables."
            : msg,
      },
      { status },
    );
  }
}
