import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { env } from "@/lib/env";
import {
  getZernioConnectionStatus,
  isZernioMcpConfigured,
  listZernioConnectedAccounts,
} from "@/services/zernio/zernioMcp";

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

  let connectedAccounts: Awaited<ReturnType<typeof listZernioConnectedAccounts>>["accounts"] = [];
  let accountsError: string | null = null;
  if (zernioStatus.connected) {
    try {
      const listed = await listZernioConnectedAccounts(parsed.data);
      connectedAccounts = listed.accounts;
    } catch (e) {
      accountsError = e instanceof Error ? e.message : "Could not load Zernio accounts";
    }
  }

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
      connectedAccounts,
      accountsError,
    },
    zapier: {
      configured: zapierConfigured,
    },
  });
}
