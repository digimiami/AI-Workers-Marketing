# MCP: Agent auth bridge

Local MCP server under `mcp/agent-auth-bridge` with tools to wire **websites and backends** to **agent HTTP APIs** (Bearer tokens, PKCE, webhook HMAC, OpenClaw env snippets, Cursor config).

## Tools

| Tool | Purpose |
|------|--------|
| `build_bearer_headers` | `Authorization: Bearer …` plus fetch/curl hints |
| `generate_pkce_pair` | PKCE `code_verifier` + S256 `code_challenge` |
| `openclaw_env_snippet` | Paste-ready `OPENCLAW_*` lines for AiWorkers |
| `hmac_sha256_hex` | Webhook-style HMAC-SHA256 hex signature |
| `random_secret_hex` | Random hex for API keys / `CRON_SECRET` |
| `cursor_mcp_server_entry` | JSON fragment for Cursor `mcpServers` |

Secrets are only used in-memory for the tool call; nothing is persisted by this server.

## Setup

```bash
cd mcp/agent-auth-bridge
npm install
npm run build
```

## Cursor

1. **Settings → MCP → Add server** (or edit JSON).
2. Use either **built** entry (after `npm run build`):

```json
{
  "mcpServers": {
    "aiworkers-agent-auth-bridge": {
      "command": "node",
      "args": ["C:/absolute/path/to/aiworkers-vip/mcp/agent-auth-bridge/dist/index.js"]
    }
  }
}
```

Or **dev** (no build; needs `npx` + network first time for `tsx`):

```json
{
  "mcpServers": {
    "aiworkers-agent-auth-bridge": {
      "command": "npx",
      "args": ["-y", "tsx", "C:/absolute/path/to/aiworkers-vip/mcp/agent-auth-bridge/src/index.ts"]
    }
  }
}
```

Adjust the path for your machine. Restart Cursor after saving.

## Run manually (stdio)

```bash
cd mcp/agent-auth-bridge
npm run start
```

The process speaks MCP over stdin/stdout; it is meant for IDE integration, not direct browser access.
