import type { ExecuteContext, OpenClawProvider, OpenClawProviderResult } from "@/lib/openclaw/types";

/** Local execution when OpenClaw HTTP is unavailable; still writes structured outputs via orchestration. */
export class OpenClawStubProvider implements OpenClawProvider {
  readonly id = "stub" as const;

  async healthCheck() {
    return { ok: true, message: "stub" };
  }

  async executeRun(ctx: ExecuteContext): Promise<OpenClawProviderResult> {
    const structuredOutputs = [
      {
        outputType: "openclaw.stub_response",
        content: {
          agentKey: ctx.agentKey,
          echo: ctx.input,
          memorySnapshotKeys: Object.keys(ctx.memory),
          priorOutputCount: ctx.priorOutputs.length,
          note: "Replace stub with HTTP OpenClaw provider when OPENCLAW_BASE_URL is configured.",
        },
      },
    ];
    return {
      ok: true,
      summary: `Stub run completed for ${ctx.agentName} (${ctx.agentKey})`,
      structuredOutputs,
      raw: { provider: "stub", runId: ctx.runId },
    };
  }
}
