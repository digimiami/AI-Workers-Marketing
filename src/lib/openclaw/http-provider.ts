import { env } from "@/lib/env";
import { fetchJson } from "@/lib/http";
import type { ExecuteContext, OpenClawProvider, OpenClawProviderResult } from "@/lib/openclaw/types";

/**
 * HTTP bridge to a real OpenClaw deployment.
 * Expected contract (adjust paths to your OpenClaw API):
 *   POST {baseUrl}/v1/runs  -> { summary?, structuredOutputs?, error? }
 */
export class OpenClawHttpProvider implements OpenClawProvider {
  readonly id = "http" as const;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly timeoutMs: number,
  ) {}

  async healthCheck() {
    const url = `${this.baseUrl.replace(/\/$/, "")}/health`;
    const res = await fetchJson<{ ok?: boolean }>(url, {
      method: "GET",
      headers: this.headers(),
      timeoutMs: Math.min(this.timeoutMs, 10_000),
      retries: 1,
    });
    if (!res.ok) return { ok: false, message: res.error.message };
    return { ok: true };
  }

  async executeRun(ctx: ExecuteContext): Promise<OpenClawProviderResult> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/runs`;
    const body = {
      runId: ctx.runId,
      organizationId: ctx.organizationId,
      campaignId: ctx.campaignId,
      agentKey: ctx.agentKey,
      systemPrompt: ctx.systemPrompt,
      styleRules: ctx.styleRules,
      forbiddenClaims: ctx.forbiddenClaims,
      outputFormat: ctx.outputFormat,
      input: ctx.input,
      memory: ctx.memory,
      priorOutputs: ctx.priorOutputs,
    };

    const res = await fetchJson<{
      ok?: boolean;
      summary?: string;
      structuredOutputs?: OpenClawProviderResult["structuredOutputs"];
      errorMessage?: string;
    }>(url, {
      method: "POST",
      headers: this.headers(),
      body,
      timeoutMs: this.timeoutMs,
      retries: 1,
      retryDelayMs: 800,
    });

    if (!res.ok) {
      return {
        ok: false,
        errorMessage: res.error.message,
        raw: res.error,
      };
    }

    const data = res.value;
    if (data && data.ok === false) {
      return {
        ok: false,
        errorMessage: data.errorMessage ?? "OpenClaw run failed",
        raw: data,
      };
    }

    return {
      ok: true,
      summary: data.summary,
      structuredOutputs: data.structuredOutputs,
      raw: data,
    };
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    return h;
  }
}

export function createOpenClawHttpProviderFromEnv(): OpenClawHttpProvider | null {
  const base = env.server.OPENCLAW_BASE_URL;
  if (!base) return null;
  return new OpenClawHttpProvider(
    base,
    env.server.OPENCLAW_API_KEY,
    env.server.OPENCLAW_TIMEOUT_MS,
  );
}
