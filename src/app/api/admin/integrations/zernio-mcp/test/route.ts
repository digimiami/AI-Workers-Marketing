import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import {
  formatZernioMcpError,
  normalizeZernioMcpServerUrl,
  zernioListTools,
} from "@/services/zernio/zernioMcp";
import { env } from "@/lib/env";

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
    const effectiveUrl = normalizeZernioMcpServerUrl(env.server.ZERNIO_MCP_SERVER_URL);
    const configuredRaw = env.server.ZERNIO_MCP_SERVER_URL?.trim();
    const urlWasCorrected = Boolean(
      configuredRaw &&
        configuredRaw !== effectiveUrl &&
        configuredRaw.includes("zernio.com") &&
        !configuredRaw.includes("mcp.zernio.com"),
    );

    return NextResponse.json({
      ok: true,
      toolCount: tools.length,
      serverUrl: effectiveUrl,
      urlWasCorrected,
      message: tools.length
        ? `Connected — ${tools.length} tools at ${effectiveUrl}.${urlWasCorrected ? " (ZERNIO_MCP_SERVER_URL pointed at the marketing site; update Vercel to https://mcp.zernio.com/mcp.)" : ""}`
        : `Connected — no tools in response (check Zernio account). Endpoint: ${effectiveUrl}`,
    });
  } catch (e) {
    const msg = formatZernioMcpError(e);
    const status = msg.includes("not configured") ? 503 : 502;
    return NextResponse.json(
      {
        ok: false,
        message:
          status === 503
            ? "Zernio MCP is not configured. Set ZERNIO_MCP_API_KEY (and optionally ZERNIO_MCP_SERVER_URL=https://mcp.zernio.com/mcp) in Vercel environment variables."
            : msg,
        serverUrl: normalizeZernioMcpServerUrl(env.server.ZERNIO_MCP_SERVER_URL),
      },
      { status },
    );
  }
}
