---
name: aiworkers-cloud-tools-api
description: Call AiWorkers Cloud Tools API from OpenClaw or any HTTP agent using bearer tokens, org-scoped envelopes, role/tool permissions, and approval modes. Use when the user mentions OpenClaw, cloud tools, /api/v1/cloud/tools/run, tool_name envelopes, organization_id scoping, or needs examples for calling AiWorkers tools over HTTP.
---

# AiWorkers Cloud Tools API (OpenClaw)

## Quick start (recommended auth)

- **Get `organization_id`**: the org UUID for the workspace you’re operating in.
- **Create a Cloud API token**: Admin → Settings → Cloud API tokens. Store the plaintext secret once (do not commit).
- **Endpoint**: prefer `POST /api/v1/cloud/tools/run` (alias: `POST /api/openclaw/tools/run`)

## Request format

### Headers

- `Authorization: Bearer <token>`
- `Content-Type: application/json`

### Envelope

Top-level fields accept either `snake_case` or `camelCase`.

```json
{
  "organization_id": "00000000-0000-0000-0000-000000000000",
  "trace_id": "trace_my_run_001",
  "role_mode": "campaign_launcher",
  "approval_mode": "auto",
  "tool_name": "list_campaigns",
  "input": { "organizationId": "00000000-0000-0000-0000-000000000000" }
}
```

### Auth behavior

- **Database token (recommended)**: server derives `actor` from token; `organization_id` must match token org.
- **Legacy key** (`OPENCLAW_API_KEY`): full-trust; caller must provide a valid operator `actor.user_id` in the envelope.

## Error handling

- Tool failures return `success: false` with `error.code` and often `error.details.zod` for field-level fixes.
- Common HTTP statuses:
  - `400` validation
  - `401` auth
  - `403` org mismatch / forbidden
  - `409` approval required (tool gated)

## Common patterns

### Update campaign metadata (strict)

Tool: `update_campaign`

- The tool input is **strict**. If you send unknown keys (e.g. `funnel`, `ads`, `emails` at the top level), the API returns **400** with `error.code = "VALIDATION_ERROR"`.
- Put your funnel/ads/emails object under **`input.metadata`**.

```json
{
  "organization_id": "ORG_UUID",
  "trace_id": "trace_campaign_update_001",
  "role_mode": "campaign_launcher",
  "approval_mode": "auto",
  "tool_name": "update_campaign",
  "input": {
    "organizationId": "ORG_UUID",
    "campaign_id": "CAMPAIGN_UUID",
    "metadata": {
      "funnel": { "...": "..." },
      "ads": { "...": "..." },
      "emails": { "...": "..." }
    }
  }
}
```

### Create a tracking link (affiliate)

Tool: `create_tracking_link`

```json
{
  "organization_id": "ORG_UUID",
  "trace_id": "trace_tracking_001",
  "role_mode": "campaign_launcher",
  "approval_mode": "auto",
  "tool_name": "create_tracking_link",
  "input": {
    "organizationId": "ORG_UUID",
    "destination_url": "https://example.com",
    "label": "AI marketing · TikTok",
    "campaign_id": "CAMPAIGN_UUID",
    "utm_defaults": { "utm_source": "tiktok", "utm_campaign": "ai-marketing" }
  }
}
```

### Log an analytics event

Tool: `log_analytics_event`

```json
{
  "organization_id": "ORG_UUID",
  "trace_id": "trace_event_001",
  "role_mode": "analyst_worker",
  "approval_mode": "disabled",
  "tool_name": "log_analytics_event",
  "input": {
    "organizationId": "ORG_UUID",
    "event_name": "workspace.provisioned",
    "source": "openclaw",
    "campaign_id": "CAMPAIGN_UUID",
    "metadata": { "note": "baseline" }
  }
}
```

## Reference

- Product docs: `https://ai-workers-marketing.vercel.app/docs/cloud-api`

