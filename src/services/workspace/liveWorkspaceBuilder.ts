import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildRichWorkspaceResults, mergeLiveBuildDefaults } from "@/services/ai/workspaceRichResults";
import { parseRunInput } from "@/services/ai/workspaceStreamPayloads";
import { beginMarketingPipelineRun, runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";
import { normalizeLiveWorkspaceResults } from "@/services/workspace/liveWorkspaceNormalize";
import type { LiveBuildStepKey, LiveBuildStepStatus, LiveWorkspaceResults } from "@/services/workspace/liveWorkspaceTypes";
import { fetchWorkspaceRunSnapshot, normalizeWorkspaceStreamUrl } from "@/services/workspace/workspaceRunSnapshot";

export const liveWorkspaceBuildBodySchema = z.object({
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

export type LiveWorkspaceBuildBody = z.infer<typeof liveWorkspaceBuildBodySchema>;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function asRows<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

type EmitFn = (event: string, payload: unknown) => void;

/**
 * Typed emit surface for future synchronous workers. Today the HTTP stream uses the same
 * shapes: `step` { key, status, message }, `result` { key, data }, `done`, `error`.
 */
export type LiveWorkspaceEmit = (event: "step" | "result" | "done" | "error", payload: unknown) => void;

/** Placeholder hook point for a fully synchronous worker graph; production uses `runLiveWorkspaceBuildStream` + DB polling. */
export async function runLiveWorkspaceBuild(_input: LiveWorkspaceBuildBody, _emit: LiveWorkspaceEmit): Promise<void> {
  throw new Error("Use POST /api/workspace/live-build SSE — runLiveWorkspaceBuild is reserved for future inline orchestration.");
}

/**
 * Orchestrates the marketing pipeline (OpenClaw / internal LLM / hybrid) and streams
 * normalized workspace payloads. Each poll persists reads from DB; emits are display-ready.
 */
export async function runLiveWorkspaceBuildStream(args: {
  request: Request;
  orgId: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  body: LiveWorkspaceBuildBody;
}): Promise<ReadableStream<Uint8Array>> {
  const { request, orgId, userId, supabase, body } = args;
  const admin = createSupabaseAdminClient();

  let runId = body.runId ?? null;
  let runPromise: Promise<unknown> | null = null;
  const urlSeed = body.url ? normalizeWorkspaceStreamUrl(body.url) : "";

  if (!runId) {
    const normalized = {
      ...body,
      url: body.url ? normalizeWorkspaceStreamUrl(body.url) : body.url,
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
      throw new Error("Invalid build params");
    }

    const begin = await beginMarketingPipelineRun({
      supabase,
      actorUserId: userId,
      input: {
        organizationMode: "existing",
        organizationId: orgId,
        url: required.data.url,
        mode: body.mode ?? "affiliate",
        goal: required.data.goal,
        audience: required.data.audience,
        trafficSource: required.data.trafficSource,
        funnelStyle: body.funnelStyle,
        provider: body.provider ?? "hybrid",
        approvalMode: body.approvalMode ?? "auto_draft",
        notes: null,
      } as never,
    });

    runId = begin.pipelineRunId;
    runPromise = runMarketingPipeline({
      supabase,
      actorUserId: userId,
      input: {
        organizationMode: "existing",
        organizationId: orgId,
        resumePipelineRunId: runId,
      } as never,
    });
  }

  const encoder = new TextEncoder();
  const controller = new AbortController();
  request.signal.addEventListener("abort", () => controller.abort());

  return new ReadableStream<Uint8Array>({
    start: async (ctrl) => {
      const send: EmitFn = (event, payload) => ctrl.enqueue(encoder.encode(sseEvent(event, payload)));

      send("step", { key: "research" as const, status: "running" as const, message: "Starting AI workspace build…" });
      send("result", { key: "run", data: { runId, campaignId: null } });

      const lastJson = new Map<string, string>();
      const stepSig = new Map<string, string>();
      const lastLogId = { v: "" };

      const emitStep = (key: LiveBuildStepKey, status: LiveBuildStepStatus, message: string) => {
        const sig = `${status}|${message}`;
        if (stepSig.get(key) === sig) return;
        stepSig.set(key, sig);
        send("step", { key, status, message });
      };

      const emitResult = (key: string, data: unknown) => {
        if (data == null) return;
        const ser = JSON.stringify(data);
        if (lastJson.get(key) === ser) return;
        lastJson.set(key, ser);
        send("result", { key, data });
      };

      try {
        while (!controller.signal.aborted) {
          const snap = await fetchWorkspaceRunSnapshot(admin, runId!);
          const runStatus = String(snap.run.status ?? "pending");
          const currentStage = snap.run.current_stage ? String(snap.run.current_stage) : null;
          const bundle = snap.workspaceDisplay;
          const stages = (snap.stages ?? []) as { stage_key?: string; status?: string }[];
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
            bundle?.campaign ? "Campaign ready" : "Creating campaign…",
          );
          emitStep(
            "landing",
            (bundle?.landingPages?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending",
            (bundle?.landingPages?.length ?? 0) ? "Landing page ready" : "Writing landing page…",
          );
          emitStep(
            "funnel",
            (bundle?.funnelSteps?.length ?? 0) ? "complete" : currentStage === "strategy" || currentStage === "creation" ? "running" : "pending",
            (bundle?.funnelSteps?.length ?? 0) ? "Funnel provisioned" : "Building funnel…",
          );
          emitStep(
            "content",
            (bundle?.contentAssets?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending",
            (bundle?.contentAssets?.length ?? 0) ? "Content ready" : "Generating hooks & scripts…",
          );
          emitStep(
            "ads",
            (bundle?.adCreatives?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending",
            (bundle?.adCreatives?.length ?? 0) ? "Ads ready" : "Creating ad angles…",
          );
          emitStep(
            "emails",
            (bundle?.emailSequenceSteps?.length ?? 0) ? "complete" : currentStage === "creation" || currentStage === "execution" ? "running" : "pending",
            (bundle?.emailSequenceSteps?.length ?? 0) ? "Email sequence ready" : "Drafting emails…",
          );
          emitStep(
            "lead_capture",
            (bundle?.leadCaptureForms?.length ?? 0) ? "complete" : currentStage === "execution" ? "running" : "pending",
            (bundle?.leadCaptureForms?.length ?? 0) ? "Lead capture live" : "Configuring lead capture…",
          );
          emitStep(
            "analytics",
            (bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "complete" : currentStage === "execution" || currentStage === "optimization" ? "running" : "pending",
            (bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "Tracking ready" : "Initializing analytics…",
          );
          emitStep(
            "approvals",
            (bundle?.approvals?.length ?? 0) ? "complete" : currentStage === "execution" ? "running" : "pending",
            (bundle?.approvals?.length ?? 0) ? "Approvals queued" : "Creating approval checkpoints…",
          );

          const runInput = parseRunInput(snap.run);
          const campaignIdStr = (snap.run as { campaign_id?: string | null }).campaign_id
            ? String((snap.run as { campaign_id?: string | null }).campaign_id)
            : null;
          emitResult("run", { runId, campaignId: campaignIdStr });

          const executionTouched =
            currentStage === "execution" ||
            currentStage === "optimization" ||
            st("execution") === "running" ||
            st("execution") === "completed" ||
            st("execution") === "failed" ||
            st("execution") === "needs_approval";

          let rich: Record<string, unknown> = bundle
            ? buildRichWorkspaceResults(bundle, snap.run, runInput, executionTouched)
            : {};
          const hint = urlSeed || str(runInput?.url);
          rich = mergeLiveBuildDefaults(rich, runInput, hint);

          const live: LiveWorkspaceResults = normalizeLiveWorkspaceResults(rich);

          const emitMaybe = (key: string, data: unknown) => {
            if (data == null) return;
            emitResult(key, data);
          };
          emitMaybe("research", live.research);
          emitMaybe("campaign", live.campaign);
          emitMaybe("landing", live.landing);
          emitMaybe("funnel", live.funnel);
          emitResult("content", live.content);
          emitResult("ads", live.ads);
          emitResult("emails", live.emails);
          emitMaybe("lead_capture", live.leadCapture);
          emitMaybe("analytics", live.analytics);
          emitResult("approvals", live.approvals);

          const logs = snap.logs ?? [];
          if (logs.length) {
            const tail = logs.slice(-24).map((l: { id?: string; level?: string; message?: string; created_at?: string }) => ({
              id: String(l.id ?? ""),
              level: String(l.level ?? "info"),
              message: String(l.message ?? ""),
              at: String(l.created_at ?? ""),
            }));
            const last = tail[tail.length - 1];
            if (last && last.id !== lastLogId.v) {
              lastLogId.v = last.id;
              emitResult("logs", { lines: tail });
            }
          }

          const runErrors = asRows<string>((snap.run as { errors?: unknown }).errors);
          if (runStatus === "failed" || runErrors.length) {
            let message = runErrors[0] ?? "Pipeline failed";
            // If the run error is generic, enrich it from campaign metadata (landing_fix)
            // so operators can see *which* banned phrase / anchor rule fired.
            if (message === "Generic output detected — banned phrases present" || message === "Generic output detected — banned phrases present.") {
              const campMeta = asRecord(asRecord(bundle?.campaign).metadata);
              const ge = asRecord(campMeta.growth_engine);
              const fix = asRecord(ge.landing_fix);
              const reason = str(fix.reason);
              const detail = str(fix.detail);
              if (detail) {
                message = `${message}: ${detail}`;
              } else if (reason) {
                message = `${message} (${reason})`;
              }
            }
            send("error", { key: currentStage ?? "unknown", message });
          }

          if (runStatus === "completed" || runStatus === "needs_approval" || runStatus === "failed") {
            const campaignId = (snap.run as { campaign_id?: string | null }).campaign_id
              ? String((snap.run as { campaign_id?: string | null }).campaign_id)
              : null;
            const reviewUrl = campaignId ? `/admin/workspace/review/${campaignId}` : null;
            send("done", { runId, campaignId, reviewUrl, status: runStatus });
            break;
          }

          await sleep(400);
        }

        if (runPromise) await runPromise.catch(() => null);
      } catch (e) {
        send("error", { key: "stream", message: e instanceof Error ? e.message : "Stream failed" });
      } finally {
        ctrl.close();
      }
    },
    cancel: () => controller.abort(),
  });
}
