import { env } from "@/lib/env";
import { runStrictJsonPrompt } from "@/services/ai/jsonPrompt";
import { assertAiUsageAllowed, recordAiUsage } from "@/services/ai/rateLimiter";
import {
  extractZernioToolResultPayload,
  formatZernioMcpError,
  zernioCallToolForOrg,
  zernioListToolsForOrg,
} from "@/services/zernio/zernioMcp";

export const ZERNIO_ADS_TOOL_HINTS = [
  "list_ad_campaigns",
  "create_standalone_ad",
  "boost_post",
  "get_ad_analytics",
  "search_ad_interests",
  "accounts_list",
] as const;

type McpTool = { name: string; description?: string };

function asTools(res: unknown): McpTool[] {
  const tools = (res as { tools?: unknown })?.tools;
  if (!Array.isArray(tools)) return [];
  const out: McpTool[] = [];
  for (const t of tools) {
    const r = t as { name?: unknown; description?: unknown };
    const name = typeof r.name === "string" ? r.name : "";
    if (!name) continue;
    out.push({ name, description: typeof r.description === "string" ? r.description : undefined });
  }
  return out;
}

export function filterZernioAdsTools(tools: McpTool[]): McpTool[] {
  const ads = tools.filter((t) => {
    const n = t.name.toLowerCase();
    return (
      n.includes("ad") ||
      n.includes("boost") ||
      n.includes("campaign") && (n.includes("list") || n.includes("create") || n.includes("get"))
    );
  });
  if (ads.length) return ads;
  return tools.filter((t) => ZERNIO_ADS_TOOL_HINTS.some((h) => t.name === h || t.name.includes(h)));
}

export async function listZernioAdsTools(organizationId: string) {
  const res = await zernioListToolsForOrg(organizationId);
  const all = asTools(res);
  return { allCount: all.length, adsTools: filterZernioAdsTools(all) };
}

function extractToolResultPayload(result: unknown): unknown {
  return extractZernioToolResultPayload(result);
}

export async function callZernioAdsTool(
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  const result = await zernioCallToolForOrg(organizationId, toolName, args);
  return { raw: result, data: extractToolResultPayload(result) };
}

export async function listZernioAdCampaigns(organizationId: string) {
  const candidates = ["list_ad_campaigns", "ads_list_campaigns", "ad_campaigns_list"];
  let lastError: unknown = null;
  for (const name of candidates) {
    try {
      const out = await callZernioAdsTool(organizationId, name, {});
      return { tool: name, ...out };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(formatZernioMcpError(lastError));
}

const ADS_AGENT_SYSTEM = `You are AiWorkers Ads Manager connected to Zernio MCP (Meta, Google, TikTok ads APIs).
Pick exactly ONE Zernio MCP tool and JSON arguments to fulfill the operator request.
Return ONLY JSON: { "tool_name": string, "arguments": object, "summary": string, "risk": "read"|"write"|"spend" }
Rules:
- Prefer list/get/analytics tools for questions; use create/boost tools only when operator explicitly asks to launch or create.
- For spend actions include realistic budgets only when operator specified them.
- Use accounts_list first mentally if account_id is required and unknown.
- tool_name MUST be from the provided tool list.`;

export async function executeZernioAdsCommand(params: {
  organizationId: string;
  userId: string;
  message: string;
  campaignId?: string | null;
  allowSpend?: boolean;
}): Promise<{
  ok: boolean;
  reply: string;
  toolName?: string;
  toolResult?: unknown;
  blocked?: boolean;
}> {
  const { adsTools } = await listZernioAdsTools(params.organizationId);
  if (!adsTools.length) {
    return {
      ok: false,
      reply: "Zernio MCP connected but no ads tools were returned. Connect ad accounts at zernio.com first.",
    };
  }

  const toolCatalog = adsTools
    .slice(0, 40)
    .map((t) => `- ${t.name}: ${t.description ?? ""}`.trim())
    .join("\n");

  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  type AdsPlan = { tool_name: string; arguments: Record<string, unknown>; summary: string; risk: string };
  let plan: AdsPlan | null = null;

  if (provider === "openai" && apiKey && model) {
    try {
      await assertAiUsageAllowed({ organizationId: params.organizationId, userId: params.userId });
      const out = await runStrictJsonPrompt({
        system: ADS_AGENT_SYSTEM,
        user: JSON.stringify({
          operator_message: params.message,
          aiworkers_campaign_id: params.campaignId ?? null,
          available_tools: toolCatalog,
        }),
        fallbackJsonText: JSON.stringify({
          tool_name: adsTools[0]?.name ?? "list_ad_campaigns",
          arguments: {},
          summary: "List ad campaigns",
          risk: "read",
        }),
        organizationId: params.organizationId,
        userId: params.userId,
      });
      if (out.meta.used) {
        try {
          plan = JSON.parse(out.jsonText) as AdsPlan;
        } catch {
          plan = null;
        }
      }
      await recordAiUsage({
        organizationId: params.organizationId,
        userId: params.userId,
        provider: "openai",
        model,
        cacheHit: false,
        metadata: { surface: "zernio_ads_agent" },
      }).catch(() => undefined);
    } catch {
      plan = null;
    }
  }

  if (!plan?.tool_name) {
    const readTool = adsTools.find((t) => t.name.includes("list") && t.name.includes("ad")) ?? adsTools[0];
    plan = {
      tool_name: readTool.name,
      arguments: {},
      summary: "List ad campaigns",
      risk: "read",
    };
  }

  const allowed = adsTools.some((t) => t.name === plan!.tool_name);
  if (!allowed) {
    return { ok: false, reply: `Tool "${plan.tool_name}" is not available on your Zernio account.` };
  }

  if (!params.allowSpend && (plan.risk === "spend" || plan.risk === "write")) {
    const isWrite = /\b(create|boost|launch|start|publish|spend)\b/i.test(plan.tool_name);
    if (isWrite) {
      return {
        ok: false,
        blocked: true,
        reply: `This action (${plan.tool_name}) can spend budget. Re-run with allowSpend=true or confirm in the Ads Manager UI.`,
        toolName: plan.tool_name,
      };
    }
  }

  try {
    const { data } = await callZernioAdsTool(params.organizationId, plan.tool_name, plan.arguments ?? {});
    const preview =
      typeof data === "string"
        ? data.slice(0, 1200)
        : JSON.stringify(data, null, 2).slice(0, 1200);
    return {
      ok: true,
      toolName: plan.tool_name,
      toolResult: data,
      reply: `${plan.summary}\n\nTool: \`${plan.tool_name}\`\n\n${preview}${preview.length >= 1200 ? "…" : ""}`,
    };
  } catch (e) {
    return {
      ok: false,
      toolName: plan.tool_name,
      reply: formatZernioMcpError(e),
    };
  }
}
