import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import {
  callZernioAdsTool,
  executeZernioAdsCommand,
  listZernioAdCampaigns,
  listZernioAdsTools,
} from "@/services/zernio/zernioAdsManager";
import { formatZernioMcpError, getZernioConnectionStatus, zernioListToolsForOrg } from "@/services/zernio/zernioMcp";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  action: z.enum(["status", "list_tools", "list_campaigns", "command", "call_tool"]),
  message: z.string().min(1).max(4000).optional(),
  campaignId: z.string().uuid().optional(),
  allowSpend: z.boolean().optional(),
  toolName: z.string().min(1).max(128).optional(),
  arguments: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  }

  const ctx = await withOrgMember(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const status = await getZernioConnectionStatus(parsed.data.organizationId);
  if (!status.connected) {
    return NextResponse.json(
      {
        ok: false,
        message: "Connect Zernio MCP first — paste your API key from zernio.com/dashboard/api-keys",
        status,
      },
      { status: 503 },
    );
  }

  try {
    if (parsed.data.action === "status") {
      const { adsTools, allCount } = await listZernioAdsTools(parsed.data.organizationId);
      return NextResponse.json({
        ok: true,
        status,
        toolCount: allCount,
        adsToolCount: adsTools.length,
        adsTools: adsTools.slice(0, 30).map((t) => ({ name: t.name, description: t.description ?? null })),
      });
    }

    if (parsed.data.action === "list_tools") {
      const res = await zernioListToolsForOrg(parsed.data.organizationId);
      const tools = Array.isArray((res as { tools?: unknown }).tools) ? (res as { tools: unknown[] }).tools : [];
      return NextResponse.json({ ok: true, toolCount: tools.length, tools });
    }

    if (parsed.data.action === "list_campaigns") {
      const out = await listZernioAdCampaigns(parsed.data.organizationId);
      return NextResponse.json({ ok: true, tool: out.tool, data: out.data });
    }

    if (parsed.data.action === "call_tool") {
      if (!parsed.data.toolName) {
        return NextResponse.json({ ok: false, message: "toolName required" }, { status: 400 });
      }
      const out = await callZernioAdsTool(
        parsed.data.organizationId,
        parsed.data.toolName,
        parsed.data.arguments ?? {},
      );
      return NextResponse.json({ ok: true, toolName: parsed.data.toolName, data: out.data, raw: out.raw });
    }

    if (!parsed.data.message) {
      return NextResponse.json({ ok: false, message: "message required" }, { status: 400 });
    }

    const out = await executeZernioAdsCommand({
      organizationId: parsed.data.organizationId,
      userId: ctx.user.id,
      message: parsed.data.message,
      campaignId: parsed.data.campaignId ?? null,
      allowSpend: parsed.data.allowSpend === true,
    });

    return NextResponse.json({
      ok: out.ok,
      reply: out.reply,
      toolName: out.toolName ?? null,
      toolResult: out.toolResult ?? null,
      blocked: out.blocked ?? false,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: formatZernioMcpError(e) }, { status: 502 });
  }
}
