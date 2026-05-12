import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { env } from "@/lib/env";

/** Hosted Zernio MCP (Streamable HTTP). See https://docs.zernio.com/mcp */
export const DEFAULT_ZERNIO_MCP_SERVER_URL = "https://mcp.zernio.com/mcp";

function getZernioConfig() {
  const apiKey = env.server.ZERNIO_MCP_API_KEY?.trim();
  if (!apiKey || apiKey.length < 10) {
    throw new Error("ZERNIO_MCP_NOT_CONFIGURED");
  }
  const serverUrl = (env.server.ZERNIO_MCP_SERVER_URL?.trim() || DEFAULT_ZERNIO_MCP_SERVER_URL).replace(/\/$/, "");
  return { serverUrl, apiKey };
}

export function isZernioMcpConfigured(): boolean {
  const k = env.server.ZERNIO_MCP_API_KEY?.trim();
  return Boolean(k && k.length >= 10);
}

export async function withZernioMcpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { serverUrl, apiKey } = getZernioConfig();
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
}

export async function zernioListTools() {
  return withZernioMcpClient(async (client) => client.listTools());
}

export async function zernioCallTool(name: string, args: Record<string, unknown>) {
  return withZernioMcpClient(async (client) => client.callTool({ name, arguments: args }));
}
