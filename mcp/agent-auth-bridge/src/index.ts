#!/usr/bin/env node
import { createHash, createHmac, randomBytes } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

function textResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const server = new McpServer(
  { name: "aiworkers-agent-auth-bridge", version: "1.0.0" },
  {
    instructions:
      "Helpers to connect websites and backend apps to agent APIs: Bearer headers, PKCE for OAuth-style flows, " +
      "HMAC signatures for webhooks, OpenClaw env snippets for AiWorkers, and Cursor MCP wiring. " +
      "Secrets you pass into tools are only used in-memory for this request; nothing is stored by the server.",
  },
);

server.registerTool(
  "build_bearer_headers",
  {
    description:
      "Build Authorization: Bearer … headers plus a minimal fetch/curl example for calling an agent HTTP API.",
    inputSchema: {
      accessToken: z.string().min(8).describe("Bearer access token or API key string"),
      extraHeaders: z.record(z.string(), z.string()).optional().describe("Additional static headers (e.g. X-Request-Id)"),
    },
  },
  async ({ accessToken, extraHeaders }) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    };
    return textResult({
      headers,
      fetch_example: {
        javascript:
          "await fetch('https://your-agent-host/v1/runs', { method: 'POST', headers, body: JSON.stringify(payload) })",
      },
      curl_example: `curl -sS -X POST 'https://your-agent-host/v1/runs' \\\n  -H 'Authorization: Bearer <token>' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"runId":"..."}'`,
      notes: [
        "Never commit tokens to git; use env vars or a secret manager.",
        "AiWorkers OpenClaw bridge uses OPENCLAW_API_KEY the same way (Bearer on server-side requests).",
      ],
    });
  },
);

server.registerTool(
  "generate_pkce_pair",
  {
    description:
      "Generate OAuth PKCE code_verifier and S256 code_challenge for public clients (SPAs / mobile) calling your auth server.",
    inputSchema: {
      verifierByteLength: z
        .number()
        .int()
        .min(32)
        .max(96)
        .optional()
        .describe("Byte length for random verifier (default 32)"),
    },
  },
  async ({ verifierByteLength }) => {
    const len = verifierByteLength ?? 32;
    const verifier = toBase64Url(randomBytes(len));
    const challenge = toBase64Url(createHash("sha256").update(verifier, "utf8").digest());
    return textResult({
      verifier_byte_length: len,
      code_verifier: verifier,
      code_challenge: challenge,
      code_challenge_method: "S256",
      notes: [
        "Send code_challenge with the authorization request; keep code_verifier secret until token exchange.",
        "Store verifier in session or secure client storage only for the duration of the flow.",
      ],
    });
  },
);

server.registerTool(
  "openclaw_env_snippet",
  {
    description: "Produce a ready-to-paste .env snippet for AiWorkers → OpenClaw HTTP bridge (OPENCLAW_*).",
    inputSchema: {
      baseUrl: z.string().url().describe("Public base URL of OpenClaw (e.g. https://xxx.ngrok-free.dev)"),
      apiKey: z.string().min(10).optional().describe("Optional; omit if OpenClaw does not require Bearer auth"),
      timeoutMs: z
        .number()
        .int()
        .positive()
        .max(600_000)
        .optional()
        .describe("Timeout in ms (default 45000)"),
    },
  },
  async ({ baseUrl, apiKey, timeoutMs }) => {
    const ms = timeoutMs ?? 45_000;
    const lines = [
      `OPENCLAW_BASE_URL="${baseUrl.replace(/\/$/, "")}"`,
      `OPENCLAW_TIMEOUT_MS="${ms}"`,
    ];
    if (apiKey) lines.splice(1, 0, `OPENCLAW_API_KEY="${apiKey}"`);
    return textResult({
      env_snippet: lines.join("\n"),
      health_url: `${baseUrl.replace(/\/$/, "")}/health`,
      runs_url: `${baseUrl.replace(/\/$/, "")}/v1/runs`,
      notes: [
        "Place values in .env.local (Next.js) or Vercel env; do not commit secrets.",
        "AiWorkers calls GET /health and POST /v1/runs relative to OPENCLAW_BASE_URL.",
      ],
    });
  },
);

server.registerTool(
  "hmac_sha256_hex",
  {
    description:
      "Compute HMAC-SHA256(message, secret) as hex — common pattern for webhook X-Signature headers.",
    inputSchema: {
      secret: z.string().min(1),
      message: z.string().min(1).describe("Exact raw body string bytes as received (UTF-8)"),
    },
  },
  async ({ secret, message }) => {
    const hex = createHmac("sha256", secret).update(message, "utf8").digest("hex");
    return textResult({
      hmac_sha256_hex: hex,
      header_suggestion: `sha256=${hex}`,
      notes: [
        "Prefer constant-time comparison on the receiver.",
        "If your provider uses a prefix (e.g. sha256=), strip it before comparing.",
      ],
    });
  },
);

server.registerTool(
  "random_secret_hex",
  {
    description:
      "Generate a cryptographically random hex string for API keys, CRON_SECRET, or signing secrets.",
    inputSchema: {
      byteLength: z
        .number()
        .int()
        .min(16)
        .max(64)
        .optional()
        .describe("Random bytes length before hex encoding (default 32)"),
    },
  },
  async ({ byteLength }) => {
    const bl = byteLength ?? 32;
    const secret = randomBytes(bl).toString("hex");
    return textResult({
      secret_hex: secret,
      byteLength: bl,
    });
  },
);

server.registerTool(
  "cursor_mcp_server_entry",
  {
    description:
      "Emit a JSON fragment for Cursor / Claude Desktop mcp.json to run this auth-bridge MCP via npx tsx.",
    inputSchema: {
      packageDir: z
        .string()
        .min(1)
        .describe("Absolute path to mcp/agent-auth-bridge (folder containing package.json)"),
      useBuilt: z
        .boolean()
        .optional()
        .describe("If true, use node dist/index.js after npm run build"),
    },
  },
  async ({ packageDir, useBuilt }) => {
    const built = useBuilt ?? false;
    const normalized = packageDir.replace(/\\/g, "/");
    const entry = built
      ? {
          command: "node",
          args: [`${normalized}/dist/index.js`],
        }
      : {
          command: "npx",
          args: ["-y", "tsx", `${normalized}/src/index.ts`],
        };
    return textResult({
      mcpServers_fragment: {
        "aiworkers-agent-auth-bridge": entry,
      },
      merge_instructions:
        "Merge the `aiworkers-agent-auth-bridge` key under `mcpServers` in your Cursor MCP settings JSON.",
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
