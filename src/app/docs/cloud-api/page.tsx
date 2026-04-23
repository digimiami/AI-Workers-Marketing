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
        </section>
      </div>
    </PublicShell>
  );
}
