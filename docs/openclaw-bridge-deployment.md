# OpenClaw · Bridge deployment (AiWorkers → external OpenClaw API)

AiWorkers can call a **remote OpenClaw-compatible HTTP service** to execute agent runs (instead of the built-in **stub**). Configure this on the **Next.js server** (e.g. Vercel environment variables).

The **reverse** direction (OpenClaw or any HTTP client calling **into** AiWorkers tools) uses **Cloud API tokens** and is documented at **`/docs/cloud-api`** on your deployed origin.

---

## 1. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENCLAW_BASE_URL` | Yes, for HTTP mode | Base URL of your OpenClaw API, e.g. `https://api.your-provider.com` (no trailing slash required). |
| `OPENCLAW_API_KEY` | Optional | Sent as `Authorization: Bearer <key>` on outbound requests. |
| `OPENCLAW_TIMEOUT_MS` | Optional | Default in `.env.example` is `45000`. |

Copy from **`.env.example`** in the repo root. After changing Vercel env vars, **redeploy** or wait for the runtime to pick up new values.

---

## 2. Feature flag

In code, `getOpenClawProvider()` uses `enable_openclaw` from default feature flags (`src/lib/featureFlags.ts`). If OpenClaw is disabled there, the app uses the **stub** regardless of `OPENCLAW_BASE_URL`.

---

## 3. HTTP contract (what AiWorkers expects)

Implemented in **`src/lib/openclaw/http-provider.ts`**.

### Health check

- **Method / URL:** `GET {OPENCLAW_BASE_URL}/health`
- **Success:** JSON body may include `{ "ok": true }` (loosely checked); non-throwing 2xx is treated as healthy for the admin agents list “backend health” probe.

### Execute run

- **Method / URL:** `POST {OPENCLAW_BASE_URL}/v1/runs`
- **Headers:** `Authorization: Bearer <OPENCLAW_API_KEY>` when the key is set; `Content-Type: application/json` on POST body.
- **JSON body (camelCase keys):**  
  `runId`, `organizationId`, `campaignId`, `agentKey`, `systemPrompt`, `styleRules`, `forbiddenClaims`, `outputFormat`, `input`, `memory`, `priorOutputs`  
  (see `ExecuteContext` in `src/lib/openclaw/types.ts` and the provider implementation for the exact object).

**Successful response shape (expected):**

- Either implicit success with optional `summary` and `structuredOutputs`, or  
- Explicit failure: `{ "ok": false, "errorMessage": "..." }`

Your OpenClaw service should accept this payload and return JSON compatible with the provider’s parsing.

---

## 4. How the app chooses stub vs HTTP

`describeOpenClawBackend()` (`src/lib/openclaw/factory.ts`):

1. If `enable_openclaw` is false → **stub**.
2. Else if `OPENCLAW_BASE_URL` is unset → **stub** (`httpConfigured: false`).
3. Else → **HTTP** provider (`active: "http"`).

Admin **AI Workers** page and **`/admin/dev/health`** surface which mode is active.

---

## 5. Security notes

- **`OPENCLAW_API_KEY`** is a **server secret**; never expose it in `NEXT_PUBLIC_*` variables or client bundles.
- Prefer **per-org Cloud API tokens** (`/admin/settings`) for **inbound** tool calls instead of the legacy deployment-wide key when possible (see Cloud API doc page).

---

## 6. Troubleshooting

| Symptom | Check |
|---------|--------|
| Agents list works but runs never hit your server | `OPENCLAW_BASE_URL` missing or typo; still on **stub**. |
| 401 from OpenClaw | `OPENCLAW_API_KEY` mismatch or missing on AiWorkers side. |
| Timeouts | Raise `OPENCLAW_TIMEOUT_MS`; verify OpenClaw service latency and cold start. |
| Health always red | OpenClaw must expose **`GET /health`** reachable from Vercel (no localhost). |

---

## 7. Related doc

- **Operators using the website:** **`openclaw-site-operator-guide.md`**.
