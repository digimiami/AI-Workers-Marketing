import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildRichWorkspaceResults, mergeLiveBuildDefaults } from "@/services/ai/workspaceRichResults";
import { parseRunInput } from "@/services/ai/workspaceStreamPayloads";
import { beginMarketingPipelineRun, runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { fetchWorkspaceRunSnapshot, normalizeWorkspaceStreamUrl } from "@/services/workspace/workspaceRunSnapshot";

export const workspaceStreamQuerySchema = z.object({
  runId: z.string().uuid().optional(),
  url: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  audience: z.string().min(1).optional(),
  trafficSource: z.string().min(1).optional(),
  funnelStyle: z.enum(["clickfunnels_lead", "bridge_lead", "application", "webinar", "product_offer"]).optional(),
  provider: z.enum(["openclaw", "internal_llm", "hybrid"]).optional(),
  approvalMode: z.enum(["required", "auto_draft"]).optional(),
  mode: z.enum(["affiliate", "client"]).optional(),
});

export type WorkspaceStreamQuery = z.infer<typeof workspaceStreamQuerySchema>;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export { normalizeWorkspaceStreamUrl, fetchWorkspaceRunSnapshot } from "@/services/workspace/workspaceRunSnapshot";

/** SSE module / timeline key → live `step` event `type` (spec-aligned). */
function moduleToLiveStepType(module: string): string {
  if (module === "leadCapture" || module === "lead_capture") return "leads";
  return module;
}

export type WorkspaceStreamOptions = {
  /** Emit `{ type, status: start|complete, payload? }` on `step` alongside legacy `{ step, status, message }`. */
  liveStepEnvelope?: boolean;
};

export async function runWorkspaceStreamResponse(request: Request, parsed: WorkspaceStreamQuery, options?: WorkspaceStreamOptions) {
  const liveStepEnvelope = Boolean(options?.liveStepEnvelope);
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const orgCtx = await withOrgMember(orgId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  let runId = parsed.runId ?? null;
  let runPromise: Promise<unknown> | null = null;
  const urlSeed = parsed.url ? normalizeWorkspaceStreamUrl(parsed.url) : "";

  if (!runId) {
    const normalized = {
      ...parsed,
      url: parsed.url ? normalizeWorkspaceStreamUrl(parsed.url) : parsed.url,
    };

    const required = z
      .object({
        url: z.string().url(),
        goal: z.string().min(1),
        audience: z.string().min(1),
        trafficSource: z.string().min(1),
      })
      .safeParse(normalized);
    if (!required.success) {
      return NextResponse.json(
        { ok: false, message: "Invalid params", issues: required.error.flatten() },
        { status: 400 },
      );
    }

    const begin = await beginMarketingPipelineRun({
      supabase,
      actorUserId: orgCtx.user.id,
      input: {
        organizationMode: "existing",
        organizationId: orgId,
        url: required.data.url,
        mode: parsed.mode ?? "affiliate",
        goal: required.data.goal,
        audience: required.data.audience,
        trafficSource: required.data.trafficSource,
        funnelStyle: parsed.funnelStyle,
        provider: parsed.provider ?? "hybrid",
        approvalMode: parsed.approvalMode ?? "auto_draft",
        notes: null,
      } as any,
    });

    runId = begin.pipelineRunId;
    runPromise = runMarketingPipeline({
      supabase,
      actorUserId: orgCtx.user.id,
      input: {
        organizationMode: "existing",
        organizationId: orgId,
        resumePipelineRunId: runId,
      } as any,
    });
  }

  const encoder = new TextEncoder();
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  const pollMs = liveStepEnvelope ? 420 : 900;

  const stream = new ReadableStream<Uint8Array>({
    start: async (ctrl) => {
      const send = (event: string, data: unknown) => ctrl.enqueue(encoder.encode(sseEvent(event, data)));

      send("step", { step: "research", status: "running", message: "Starting AI workspace build…" });
      send("result", { module: "run", data: { runId, campaignId: null } });

      const lastModuleJson = new Map<string, string>();
      const stepSig = new Map<string, string>();
      const stepPrevUi = new Map<string, string>();

      const emitStep = (key: string, status: "pending" | "running" | "complete" | "failed", message: string) => {
        const prev = stepPrevUi.get(key) ?? "pending";
        stepPrevUi.set(key, status);
        const sig = `${status}|${message}`;
        if (stepSig.get(key) === sig) return;
        stepSig.set(key, sig);
        send("step", { step: key, status, message });
        if (liveStepEnvelope && status === "running" && prev !== "running") {
          send("step", { type: moduleToLiveStepType(key), status: "start" });
        }
      };

      const emitModule = (module: string, data: unknown) => {
        if (data == null) return;
        const serialized = JSON.stringify(data);
        if (lastModuleJson.get(module) === serialized) return;
        lastModuleJson.set(module, serialized);
        send("result", { module, data });
        if (liveStepEnvelope && module !== "run") {
          send("step", { type: moduleToLiveStepType(module), status: "complete", payload: data });
        }
      };

      try {
        while (!controller.signal.aborted) {
          const snap = await fetchWorkspaceRunSnapshot(admin, runId!);

          const runStatus = String(snap.run.status ?? "pending");
          const currentStage = snap.run.current_stage ? String(snap.run.current_stage) : null;
          const bundle = snap.workspaceDisplay;

          const stages = (snap.stages ?? []) as any[];
          const st = (k: string) => String(stages.find((x) => String(x.stage_key) === k)?.status ?? "pending");

          emitStep(
            "research",
            st("research") === "running"
              ? "running"
              : st("research") === "completed"
                ? "complete"
                : st("research") === "failed"
                  ? "failed"
                  : "pending",
            "Researching offer…",
          );
          emitStep(
            "campaign",
            bundle?.campaign ? "complete" : currentStage === "strategy" ? "running" : "pending",
            bundle?.campaign ? "Campaign created" : "Creating campaign…",
          );
          emitStep(
            "landing",
            (bundle?.landingPages?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending",
            (bundle?.landingPages?.length ?? 0) ? "Landing page created" : "Building landing page…",
          );
          emitStep(
            "funnel",
            (bundle?.funnelSteps?.length ?? 0) ? "complete" : currentStage === "strategy" || currentStage === "creation" ? "running" : "pending",
            (bundle?.funnelSteps?.length ?? 0) ? "Funnel created" : "Generating funnel…",
          );
          emitStep(
            "content",
            (bundle?.contentAssets?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending",
            (bundle?.contentAssets?.length ?? 0) ? "Content generated" : "Creating content…",
          );
          emitStep(
            "ads",
            (bundle?.adCreatives?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending",
            (bundle?.adCreatives?.length ?? 0) ? "Ads created" : "Creating ads…",
          );
          emitStep(
            "emails",
            (bundle?.emailSequenceSteps?.length ?? 0) ? "complete" : currentStage === "creation" || currentStage === "execution" ? "running" : "pending",
            (bundle?.emailSequenceSteps?.length ?? 0) ? "Emails created" : "Creating emails…",
          );
          emitStep(
            "lead_capture",
            (bundle?.leadCaptureForms?.length ?? 0) ? "complete" : currentStage === "execution" ? "running" : "pending",
            (bundle?.leadCaptureForms?.length ?? 0) ? "Lead capture setup" : "Setting up lead capture…",
          );
          emitStep(
            "analytics",
            (bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "complete" : currentStage === "execution" || currentStage === "optimization" ? "running" : "pending",
            (bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "Analytics initialized" : "Initializing analytics…",
          );
          emitStep(
            "approvals",
            (bundle?.approvals?.length ?? 0) ? "complete" : currentStage === "execution" ? "running" : "pending",
            (bundle?.approvals?.length ?? 0) ? "Approvals created" : "Creating approvals…",
          );

          const runInput = parseRunInput(snap.run);
          const campaignIdStr = (snap.run as any).campaign_id ? String((snap.run as any).campaign_id) : null;
          emitModule("run", { runId, campaignId: campaignIdStr });

          const executionTouched =
            currentStage === "execution" ||
            currentStage === "optimization" ||
            st("execution") === "running" ||
            st("execution") === "completed" ||
            st("execution") === "failed" ||
            st("execution") === "needs_approval";

          let rich: Record<string, unknown> = bundle
            ? buildRichWorkspaceResults(bundle, snap.run, runInput, executionTouched)
            : ({} as Record<string, unknown>);

          const hint = urlSeed || str(runInput?.url);
          rich = mergeLiveBuildDefaults(rich, runInput, hint);

          const emitIf = (module: string, data: unknown) => {
            if (data == null) return;
            emitModule(module, data);
          };

          emitIf("research", rich.research);
          emitIf("campaign", rich.campaign);
          emitIf("landing", rich.landing);
          if (rich.funnel != null) emitModule("funnel", rich.funnel);
          emitIf("content", rich.content);
          emitIf("ads", rich.ads);
          emitIf("emails", rich.emails);
          emitIf("leadCapture", rich.leadCapture);
          if (rich.analytics != null) emitModule("analytics", rich.analytics);
          emitIf("approvals", rich.approvals);

          const runErrors = asRows<string>((snap.run as any).errors);
          if (runStatus === "failed" || runErrors.length) {
            send("error", { step: currentStage ?? "unknown", message: runErrors[0] ?? "Pipeline failed" });
          }

          if (runStatus === "completed" || runStatus === "needs_approval" || runStatus === "failed") {
            const campaignId = (snap.run as any).campaign_id ? String((snap.run as any).campaign_id) : null;
            const reviewUrl = campaignId ? `/admin/workspace/review/${campaignId}` : null;
            send("done", { runId, campaignId, reviewUrl, status: runStatus });
            break;
          }

          await sleep(pollMs);
        }

        if (runPromise) await runPromise.catch(() => null);
      } catch (e) {
        send("error", { step: "stream", message: e instanceof Error ? e.message : "Stream failed" });
      } finally {
        ctrl.close();
      }
    },
    cancel: () => controller.abort(),
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
