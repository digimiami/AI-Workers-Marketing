import Link from "next/link";

import { PublicShell } from "@/components/marketing/PublicShell";

export const metadata = {
  title: "Cloud API (OpenClaw & agents) · AiWorkers",
  description:
    "Machine-to-machine API for org-scoped tools: authentication, endpoints, and JSON envelope format.",
};

export default function CloudApiDocsPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-16 space-y-8 text-sm leading-relaxed">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Cloud tools API</h1>
          <p className="text-muted-foreground">
            Call AiWorkers from OpenClaw or any HTTP agent using a bearer token. All tool runs are scoped to one
            organization.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Organization</h2>
          <p>
            Create an organization from the app (sign in → onboarding / admin). Copy your{" "}
            <strong>organization UUID</strong> from the admin URL or team settings. Every request must include that
            same <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">organization_id</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Token</h2>
          <p>
            <strong>Recommended:</strong> an operator signs in →{" "}
            <Link className="text-primary underline" href="/admin/settings">
              Admin → Settings
            </Link>{" "}
            → <strong>Cloud API tokens</strong> → create token. The plaintext secret is shown once; store it in
            OpenClaw or your secret manager.
          </p>
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950/90 dark:text-amber-200/90">
            <strong>Never paste the full token into an LLM chat</strong> (including “OpenClaw” conversation threads).
            Put the complete <code className="font-mono text-xs">aiw_…</code> string only in OpenClaw’s{" "}
            <strong>secret / env / credential</strong> UI. If you already exposed a token, revoke it and create a new
            one.
          </p>
          <p className="text-muted-foreground">
            The <strong>Existing tokens</strong> list only shows a short <code className="font-mono text-xs">token_prefix</code>{" "}
            (it may end with <code className="font-mono text-xs">…</code>). That is <strong>not</strong> a truncated secret
            you can “complete” — it is display-only. After you click create, use the <strong>full token</strong> from the
            confirmation dialog (or your clipboard right at creation time).
          </p>
          <p>
            <strong>Alternative:</strong> deployment-wide legacy key{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">OPENCLAW_API_KEY</code> (Vercel env). When
            used, the JSON body must include a valid operator <code className="font-mono text-xs">actor.user_id</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Endpoints</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="font-mono text-xs">POST /api/v1/cloud/tools/run</code> (preferred)
            </li>
            <li>
              <code className="font-mono text-xs">POST /api/openclaw/tools/run</code> (alias)
            </li>
          </ul>
          <p className="text-muted-foreground">
            Use your canonical site origin, e.g. <code className="font-mono text-xs">https://www.aiworkers.vip</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">4. Headers</h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs">
            {`Authorization: Bearer <your_token>
Content-Type: application/json`}
          </pre>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">5. JSON envelope</h2>
          <p>
            Either <strong>snake_case</strong> or <strong>camelCase</strong> top-level fields are accepted (e.g.{" "}
            <code className="font-mono text-xs">organization_id</code> or <code className="font-mono text-xs">organizationId</code>
            ).
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs">
            {`{
  "organization_id": "<uuid>",
  "trace_id": "trace_my_run_001",
  "role_mode": "campaign_launcher",
  "approval_mode": "auto",
  "tool_name": "list_campaigns",
  "input": { "organizationId": "<uuid>" }
}`}
          </pre>
          <p>
            With a <strong>database token</strong>, <code className="font-mono text-xs">actor</code> is set by the
            server from the token; <code className="font-mono text-xs">organization_id</code> must match the token’s
            organization.
          </p>
          <p className="text-muted-foreground">
            Allowed <code className="font-mono text-xs">role_mode</code> values include{" "}
            <code className="font-mono text-xs">campaign_launcher</code>,{" "}
            <code className="font-mono text-xs">analyst</code>, <code className="font-mono text-xs">analyst_worker</code>
            , <code className="font-mono text-xs">content_strategist</code>, and others enforced per tool.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Errors</h2>
          <p>
            On validation failure the API returns{" "}
            <code className="font-mono text-xs">success: false</code> with{" "}
            <code className="font-mono text-xs">error.details.zod</code> (field issues) so you can fix the payload
            without guessing.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <strong>401</strong> — missing/invalid <code className="font-mono text-xs">Authorization: Bearer</code>{" "}
              (wrong Cloud API token or revoked token).
            </li>
            <li>
              <strong>403</strong> — <code className="font-mono text-xs">organization_id</code> in the JSON body does
              not exactly match the organization bound to the Cloud API token.
            </li>
            <li>
              <strong>409</strong> — <code className="font-mono text-xs">APPROVAL_REQUIRED</code> — tool needs human
              approval; surface to the operator / approvals queue instead of retrying blindly.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Marketing Team Pipeline (stage-based)</h2>
          <p>
            AiWorkers includes a stage-based marketing operating system called the{" "}
            <strong>AiWorkers Marketing Team Pipeline</strong>:
          </p>
          <p className="text-muted-foreground">
            <strong>RESEARCH</strong> → <strong>STRATEGY</strong> → <strong>CREATION</strong> →{" "}
            <strong>EXECUTION</strong> → <strong>OPTIMIZATION</strong>
          </p>
          <p>
            Important: external agents (OpenClaw) must still use the <strong>Cloud tools API</strong> and the internal
            tool layer. Do not call raw database endpoints. High-risk actions must remain approval-gated (publish/send/activate).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">8. System instructions for agents (copy-paste)</h2>
          <p className="text-muted-foreground">
            Paste the block below into OpenClaw (or any LLM agent) <strong>system</strong> or <strong>developer</strong>{" "}
            instructions so the agent always uses Cloud API tokens correctly. Replace{" "}
            <code className="font-mono text-xs">{"{APP_BASE_URL}"}</code> with your production origin (e.g.{" "}
            <code className="font-mono text-xs">https://aiworkers.vip</code>).
          </p>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-mono text-[11px] leading-relaxed">
            {`You are an autonomous agent integrating with AiWorkers.

Authentication (required)
- All machine calls go to the Cloud Tools API: POST {APP_BASE_URL}/api/v1/cloud/tools/run
- Use HTTP Bearer auth with a Cloud API token created by a human operator in the AiWorkers admin UI:
  Admin → Settings → Cloud API → "Create token & copy to clipboard".
- The token plaintext is shown once. Store it in a secret manager; never commit it to git or paste into public channels.

Operating mode (important)
- Your goal is to help run the AiWorkers Marketing Team Pipeline:
  RESEARCH → STRATEGY → CREATION → EXECUTION → OPTIMIZATION
- You MUST interact only through the Cloud Tools API (tools). Never attempt direct database access.
- High-risk actions MUST be approval-gated (publish content, send emails, activate ads, activate affiliate CTA, change settings).

Headers
- Authorization: Bearer <CLOUD_API_TOKEN>
- Content-Type: application/json

Body rules (critical)
- Send a JSON object (tool run envelope). camelCase or snake_case top-level fields are accepted.
- organization_id is mandatory and must be the exact UUID of the org that owns the Cloud API token. Mismatch → 403.
- For Cloud API tokens, the server forces actor from the token (you cannot impersonate another user).
- Include trace_id (8–120 chars) per logical operation for correlation.
- Set role_mode to the workflow (e.g. campaign_launcher, funnel_architect, analyst, supervisor).
- Set approval_mode: use "enforced" for outbound/high-risk actions that require human approval.
- Set tool_name and input (object) per the tool registry.
- Tool inputs may be STRICT: do not send unknown keys. Example: update_campaign requires funnel/ads/emails under input.metadata (unknown top-level keys → 400 VALIDATION_ERROR).

Do not
- Never ask for or use SUPABASE_SERVICE_ROLE_KEY, database passwords, or full Vercel env dumps.
- Do not assume OPENCLAW_API_KEY exists; prefer per-org Cloud API tokens from Admin → Settings.

Minimal example
POST {APP_BASE_URL}/api/v1/cloud/tools/run
Authorization: Bearer <CLOUD_API_TOKEN>

{
  "organization_id": "<ORG_UUID>",
  "trace_id": "openclaw-trace-001",
  "role_mode": "analyst",
  "approval_mode": "enforced",
  "tool_name": "<TOOL_NAME>",
  "input": {},
  "campaign_id": "<OPTIONAL_CAMPAIGN_UUID>"
}`}
          </pre>
          <p>
            <strong>One-liner for task prompts:</strong> use the operator-created Cloud API token from{" "}
            <Link className="text-primary underline" href="/admin/settings">
              Admin → Settings → Cloud API
            </Link>
            , call <code className="font-mono text-xs">POST {"{APP_BASE_URL}"}/api/v1/cloud/tools/run</code> with{" "}
            <code className="font-mono text-xs">Authorization: Bearer …</code>, and set{" "}
            <code className="font-mono text-xs">organization_id</code> to the token’s org UUID exactly.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
