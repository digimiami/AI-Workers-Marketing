import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { env } from "@/lib/env";
import { getZernioConnectionStatus, isZernioMcpConfigured } from "@/services/zernio/zernioMcp";

/**
 * MCP integration flags for admin UI (no secrets returned).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const parsed = z.string().uuid().safeParse(organizationId);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data);
  if (ctx.error) return ctx.error;

  const zapierConfigured = Boolean(
    env.server.ZAPIER_MCP_SERVER_URL?.trim() && env.server.ZAPIER_MCP_SECRET && env.server.ZAPIER_MCP_SECRET.length >= 10,
  );

  const zernioStatus = await getZernioConnectionStatus(parsed.data);

  return NextResponse.json({
    ok: true,
    zernio: {
      configured: zernioStatus.connected || isZernioMcpConfigured(),
      orgConnected: zernioStatus.orgConnected,
      envFallback: zernioStatus.envFallback,
      serverUrl: zernioStatus.serverUrl,
      configuredServerUrl: env.server.ZERNIO_MCP_SERVER_URL?.trim() || null,
      urlWarning: zernioStatus.urlWarning,
      urlWarningMessage: zernioStatus.urlWarningMessage,
    },
    zapier: {
      configured: zapierConfigured,
    },
  });
}
