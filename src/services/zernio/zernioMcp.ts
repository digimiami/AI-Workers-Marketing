import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptJson, encryptJson } from "@/services/platforms/credentialsCrypto";

/** Hosted Zernio MCP (Streamable HTTP). See https://docs.zernio.com/mcp */
export const DEFAULT_ZERNIO_MCP_SERVER_URL = "https://mcp.zernio.com/mcp";

/** User-facing hint when the MCP client received a marketing/docs HTML page instead of MCP JSON. */
export const ZERNIO_WRONG_ENDPOINT_HINT =
  "Use ZERNIO_MCP_SERVER_URL=https://mcp.zernio.com/mcp (not https://zernio.com). Create keys at https://zernio.com/dashboard/api-keys";

function looksLikeHtmlMarketingPage(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("<!doctype") ||
    m.includes("<html") ||
    m.includes("__next_f") ||
    m.includes("og:site_name") ||
    m.includes("next-size-adjust") ||
    (m.includes("zernio") && m.includes("twitter:card"))
  );
}

export function formatZernioMcpError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (looksLikeHtmlMarketingPage(msg)) {
    return ZERNIO_WRONG_ENDPOINT_HINT;
  }
  if (msg.includes("ZERNIO_MCP_NOT_CONFIGURED")) {
    return "Zernio MCP is not configured. Set ZERNIO_MCP_API_KEY on the server (Vercel env).";
  }
  if (msg.length > 500) return `${msg.slice(0, 500)}…`;
  return msg;
}

/**
 * Normalizes MCP URL — common mistake is setting ZERNIO_MCP_SERVER_URL to the marketing site.
 */
export function normalizeZernioMcpServerUrl(raw: string | undefined | null): string {
  const trimmed = (raw?.trim() || DEFAULT_ZERNIO_MCP_SERVER_URL).replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return DEFAULT_ZERNIO_MCP_SERVER_URL;
  }
  const host = url.hostname.toLowerCase();
  if (host === "zernio.com" || host === "www.zernio.com" || host === "docs.zernio.com") {
    return DEFAULT_ZERNIO_MCP_SERVER_URL;
  }
  if (host === "mcp.zernio.com") {
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/mcp";
    } else if (!url.pathname.endsWith("/mcp")) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}/mcp`;
    }
    return url.toString().replace(/\/$/, "");
  }
  return trimmed;
}

export type ZernioOrgCredentials = {
  apiKey: string;
  serverUrl: string | null;
};

export async function getZernioOrgCredentials(organizationId: string): Promise<ZernioOrgCredentials | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("organization_ad_credentials" as never)
    .select("encrypted")
    .eq("organization_id", organizationId)
    .eq("platform", "zernio_mcp")
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  try {
    const decrypted = decryptJson((data as { encrypted: unknown }).encrypted);
    const k = typeof decrypted.api_key === "string" ? decrypted.api_key.trim() : "";
    if (!k || k.length < 10) return null;
    const serverUrl =
      typeof decrypted.server_url === "string" && decrypted.server_url.trim()
        ? decrypted.server_url.trim()
        : null;
    return { apiKey: k, serverUrl };
  } catch {
    return null;
  }
}

export async function saveZernioOrgCredentials(
  organizationId: string,
  input: { apiKey: string; serverUrl?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const encrypted = encryptJson({
    api_key: input.apiKey.trim(),
    server_url: input.serverUrl?.trim() ?? null,
  });
  const { error } = await admin
    .from("organization_ad_credentials" as never)
    .upsert(
      {
        organization_id: organizationId,
        platform: "zernio_mcp",
        encrypted,
        status: { connected: true, missing: [] as string[] },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "organization_id,platform" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteZernioOrgCredentials(organizationId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from("organization_ad_credentials" as never)
    .delete()
    .eq("organization_id", organizationId)
    .eq("platform", "zernio_mcp");
}

export async function isZernioMcpConfiguredForOrg(organizationId: string): Promise<boolean> {
  const org = await getZernioOrgCredentials(organizationId).catch(() => null);
  if (org?.apiKey) return true;
  return isZernioMcpConfigured();
}

export async function getZernioConnectionStatus(organizationId: string) {
  const org = await getZernioOrgCredentials(organizationId).catch(() => null);
  const envKey = Boolean(env.server.ZERNIO_MCP_API_KEY?.trim() && env.server.ZERNIO_MCP_API_KEY.length >= 10);
  const configuredRaw = org?.serverUrl ?? env.server.ZERNIO_MCP_SERVER_URL?.trim();
  const effectiveUrl = normalizeZernioMcpServerUrl(configuredRaw);
  const urlWarning = Boolean(
    configuredRaw &&
      configuredRaw !== effectiveUrl &&
      configuredRaw.includes("zernio.com") &&
      !configuredRaw.includes("mcp.zernio.com"),
  );
  return {
    connected: Boolean(org?.apiKey) || envKey,
    orgConnected: Boolean(org?.apiKey),
    envFallback: envKey && !org?.apiKey,
    serverUrl: effectiveUrl,
    urlWarning,
    urlWarningMessage: urlWarning
      ? "Zernio URL pointed at the marketing site. Use https://mcp.zernio.com/mcp."
      : null,
  };
}

async function getZernioConfig(organizationId?: string | null) {
  const orgCreds = organizationId ? await getZernioOrgCredentials(organizationId).catch(() => null) : null;
  const apiKey = (orgCreds?.apiKey ?? env.server.ZERNIO_MCP_API_KEY ?? "").trim();
  if (!apiKey || apiKey.length < 10) throw new Error("ZERNIO_MCP_NOT_CONFIGURED");
  const configured = orgCreds?.serverUrl ?? env.server.ZERNIO_MCP_SERVER_URL?.trim();
  const serverUrl = normalizeZernioMcpServerUrl(configured);
  if (
    configured &&
    (configured.includes("zernio.com") && !configured.includes("mcp.zernio.com"))
  ) {
    console.warn(
      `[zernio-mcp] ZERNIO_MCP_SERVER_URL was "${configured}" — using MCP endpoint ${serverUrl}. ${ZERNIO_WRONG_ENDPOINT_HINT}`,
    );
  }
  return { serverUrl, apiKey, source: orgCreds?.apiKey ? ("org" as const) : ("env" as const) };
}

export function isZernioMcpConfigured(): boolean {
  const k = env.server.ZERNIO_MCP_API_KEY?.trim();
  return Boolean(k && k.length >= 10);
}

export async function withZernioMcpClient<T>(
  input: { organizationId?: string | null },
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const { serverUrl, apiKey } = await getZernioConfig(input.organizationId ?? null);
  try {
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    });

    const client = new Client({ name: "aiworkers-zernio-mcp", version: "1.0.0" });
    await client.connect(transport);
    try {
      return await fn(client);
    } finally {
      await client.transport?.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  } catch (e) {
    throw new Error(formatZernioMcpError(e));
  }
}

export function extractZernioToolResultPayload(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const r = result as { content?: unknown; structuredContent?: unknown; isError?: boolean };
  if (r.structuredContent) return r.structuredContent;
  if (Array.isArray(r.content)) {
    const text = r.content
      .map((c) => {
        const row = c as { type?: string; text?: string };
        return row.type === "text" && typeof row.text === "string" ? row.text : "";
      })
      .filter(Boolean)
      .join("\n");
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
  return result;
}

export type ZernioConnectedAccount = {
  id: string;
  platform: string;
  label: string;
  status?: string;
  username?: string | null;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
  pinterest: "Pinterest",
  reddit: "Reddit",
  bluesky: "Bluesky",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  discord: "Discord",
  snapchat: "Snapchat",
  google_business: "Google Business",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
};

function platformLabel(platform: string): string {
  const key = platform.toLowerCase().replace(/\s+/g, "_");
  return PLATFORM_LABELS[key] ?? platform.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeZernioConnectedAccounts(data: unknown): ZernioConnectedAccount[] {
  const root = data as { accounts?: unknown[]; data?: { accounts?: unknown[] } } | unknown[];
  const rows = Array.isArray(root)
    ? root
    : Array.isArray(root?.accounts)
      ? root.accounts
      : Array.isArray(root?.data?.accounts)
        ? root.data.accounts
        : [];

  const out: ZernioConnectedAccount[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r._id ?? r.id ?? r.account_id ?? "").trim();
    const platform = String(r.platform ?? r.provider ?? r.type ?? "unknown").trim();
    if (!id && !platform) continue;
    const username =
      typeof r.username === "string"
        ? r.username
        : typeof r.handle === "string"
          ? r.handle
          : typeof r.name === "string"
            ? r.name
            : null;
    const status =
      typeof r.status === "string"
        ? r.status
        : typeof r.connectionStatus === "string"
          ? r.connectionStatus
          : undefined;
    out.push({
      id: id || `${platform}-${out.length}`,
      platform,
      label: platformLabel(platform),
      status,
      username,
    });
  }
  return out;
}

export async function listZernioConnectedAccounts(organizationId: string): Promise<{
  accounts: ZernioConnectedAccount[];
  tool?: string;
}> {
  const candidates = ["accounts_list", "list_accounts", "v1_accounts_list"];
  let lastError: unknown = null;
  for (const tool of candidates) {
    try {
      const result = await zernioCallToolForOrg(organizationId, tool, {});
      const data = extractZernioToolResultPayload(result);
      const accounts = normalizeZernioConnectedAccounts(data);
      return { accounts, tool };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(formatZernioMcpError(lastError));
}

export async function zernioListTools() {
  return withZernioMcpClient({}, async (client) => client.listTools());
}

export async function zernioCallTool(name: string, args: Record<string, unknown>) {
  return withZernioMcpClient({}, async (client) => client.callTool({ name, arguments: args }));
}

export async function zernioListToolsForOrg(organizationId: string) {
  return withZernioMcpClient({ organizationId }, async (client) => client.listTools());
}

export async function zernioCallToolForOrg(organizationId: string, name: string, args: Record<string, unknown>) {
  return withZernioMcpClient({ organizationId }, async (client) => client.callTool({ name, arguments: args }));
}
