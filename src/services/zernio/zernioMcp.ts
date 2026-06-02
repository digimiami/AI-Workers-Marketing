import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptJson } from "@/services/platforms/credentialsCrypto";

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

async function getZernioApiKeyForOrg(organizationId: string): Promise<string | null> {
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
    return k && k.length >= 10 ? k : null;
  } catch {
    return null;
  }
}

async function getZernioConfig(organizationId?: string | null) {
  const orgKey = organizationId ? await getZernioApiKeyForOrg(organizationId).catch(() => null) : null;
  const apiKey = (orgKey ?? env.server.ZERNIO_MCP_API_KEY ?? "").trim();
  if (!apiKey || apiKey.length < 10) throw new Error("ZERNIO_MCP_NOT_CONFIGURED");
  const configured = env.server.ZERNIO_MCP_SERVER_URL?.trim();
  const serverUrl = normalizeZernioMcpServerUrl(configured);
  if (
    configured &&
    (configured.includes("zernio.com") && !configured.includes("mcp.zernio.com"))
  ) {
    console.warn(
      `[zernio-mcp] ZERNIO_MCP_SERVER_URL was "${configured}" — using MCP endpoint ${serverUrl}. ${ZERNIO_WRONG_ENDPOINT_HINT}`,
    );
  }
  return { serverUrl, apiKey, source: orgKey ? "org" : "env" as const };
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
