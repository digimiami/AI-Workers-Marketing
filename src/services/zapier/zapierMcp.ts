import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { env } from "@/lib/env";

function getZapierConfig() {
  const serverUrl = env.server.ZAPIER_MCP_SERVER_URL;
  const secret = env.server.ZAPIER_MCP_SECRET;
  if (!serverUrl || !secret) {
    throw new Error("ZAPIER_MCP_NOT_CONFIGURED");
  }
  return { serverUrl, secret };
}

export type ZapierMcpToolCallResult = {
  content?: unknown;
  isError?: boolean;
};

export async function withZapierMcpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { serverUrl, secret } = getZapierConfig();
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    },
  });

  const client = new Client({ name: "aiworkers-zapier-mcp", version: "1.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.transport?.close().catch(() => undefined);
    await client.close().catch(() => undefined);
  }
}

export async function zapierListTools() {
  return withZapierMcpClient(async (client) => client.listTools());
}

export async function zapierCallTool(name: string, args: Record<string, unknown>) {
  return withZapierMcpClient(async (client) => client.callTool({ name, arguments: args }));
}

