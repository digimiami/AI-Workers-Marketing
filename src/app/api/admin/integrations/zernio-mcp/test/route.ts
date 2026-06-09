import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import {
  formatZernioMcpError,
  getZernioConnectionStatus,
  zernioListToolsForOrg,
} from "@/services/zernio/zernioMcp";

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

  const conn = await getZernioConnectionStatus(parsed.data.organizationId);
  if (!conn.connected) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Zernio MCP is not connected. Paste your API key in Ads Manager or Settings (zernio.com/dashboard/api-keys).",
        serverUrl: conn.serverUrl,
      },
      { status: 503 },
    );
  }

  try {
    const res = await zernioListToolsForOrg(parsed.data.organizationId);
    const tools = Array.isArray((res as { tools?: unknown }).tools)
      ? ((res as { tools: unknown[] }).tools as unknown[])
      : [];

    return NextResponse.json({
      ok: true,
      toolCount: tools.length,
      serverUrl: conn.serverUrl,
      orgConnected: conn.orgConnected,
      urlWasCorrected: conn.urlWarning,
      message: tools.length
        ? `Connected — ${tools.length} tools at ${conn.serverUrl}${conn.orgConnected ? " (org API key)" : " (server env fallback)"}.`
        : `Connected — no tools in response (connect ad accounts at zernio.com). Endpoint: ${conn.serverUrl}`,
    });
  } catch (e) {
    const msg = formatZernioMcpError(e);
    return NextResponse.json(
      {
        ok: false,
        message: msg,
        serverUrl: conn.serverUrl,
      },
      { status: 502 },
    );
  }
}
