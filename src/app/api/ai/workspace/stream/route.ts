import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgMember } from "@/app/api/admin/openclaw/_shared";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchWorkspaceDisplayBundle, buildRunTimeline } from "@/services/workspace/workspaceDisplayBundle";
import { beginMarketingPipelineRun, runMarketingPipeline } from "@/services/marketing-pipeline/runMarketingPipeline";

export const runtime = "nodejs";

const querySchema = z.object({
  runId: z.string().uuid().optional(),
  // Accept bare domains; we'll normalize to https:// before validation.
  url: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  audience: z.string().min(1).optional(),
  trafficSource: z.string().min(1).optional(),
  provider: z.enum(["openclaw", "internal_llm", "hybrid"]).optional(),
  approvalMode: z.enum(["required", "auto_draft"]).optional(),
  mode: z.enum(["affiliate", "client"]).optional(),
});

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

function normalizeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t)) return t;
  // If user pasted a domain like "example.com/path", default to https.
  return `https://${t}`;
}

async function fetchRunSnapshot(admin: ReturnType<typeof createSupabaseAdminClient>, runId: string) {
  const { data: run, error: runErr } = await admin
    .from("marketing_pipeline_runs" as never)
    .select(
      "id,organization_id,campaign_id,provider,approval_mode,status,current_stage,started_at,finished_at,warnings,errors,input,created_at,updated_at",
    )
    .eq("id", runId)
    .maybeSingle();
  if (runErr) throw new Error(runErr.message);
  if (!run) throw new Error("Run not found");

  const { data: stages } = await admin
    .from("marketing_pipeline_stages" as never)
    .select("id,stage_key,status,started_at,finished_at,output_summary,error_message,created_at,updated_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true });

  const { data: outputs } = await admin
    .from("marketing_pipeline_stage_outputs" as never)
    .select("id,stage_id,output_type,content,created_record_refs,created_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true })
    .limit(200);

  const { data: logs } = await admin
    .from("marketing_pipeline_stage_logs" as never)
    .select("id,stage_id,level,message,data,created_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true })
    .limit(400);

  const { data: workerOutputs } = await admin
    .from("ai_worker_skill_outputs" as never)
    .select("id,stage_id,skill_key,status,output,provider,created_at")
    .eq("pipeline_run_id", runId)
    .order("created_at", { ascending: true })
    .limit(400);

  const orgId = String((run as any).organization_id);
  const campaignId = (run as any).campaign_id ? String((run as any).campaign_id) : null;

  let workspaceDisplay: Awaited<ReturnType<typeof fetchWorkspaceDisplayBundle>> | null = null;
  if (campaignId) {
    workspaceDisplay = await fetchWorkspaceDisplayBundle(admin, orgId, campaignId);
  }

  const snapshot = {
    status: String((run as any).status ?? "pending"),
    current_stage: (run as any).current_stage ? String((run as any).current_stage) : null,
    stages: asRows<any>(stages).map((s: any) => ({
      stage_key: String(s.stage_key ?? ""),
      status: String(s.status ?? "pending"),
      output_summary: s.output_summary ?? null,
      error_message: s.error_message ?? null,
    })),
    logs: asRows<any>(logs).map((l: any) => ({
      id: String(l.id),
      level: String(l.level ?? "info"),
      message: String(l.message ?? ""),
      created_at: String(l.created_at ?? ""),
      stage_id: l.stage_id ? String(l.stage_id) : null,
    })),
  };

  const runTimeline = buildRunTimeline(snapshot as any, workspaceDisplay);

  return {
    run: run as any,
    stages: asRows<any>(stages),
    outputs: asRows<any>(outputs),
    logs: asRows<any>(logs),
    workerOutputs: asRows<any>(workerOutputs),
    workspaceDisplay,
    runTimeline,
  };
}

async function handleStream(request: Request, parsed: z.infer<typeof querySchema>) {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) return NextResponse.json({ ok: false, message: "No organization selected" }, { status: 401 });

  const orgCtx = await withOrgMember(orgId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  // Start a new run unless caller provided runId.
  let runId = parsed.runId ?? null;
  let runPromise: Promise<unknown> | null = null;

  if (!runId) {
    const normalized = {
      ...parsed,
      url: parsed.url ? normalizeUrl(parsed.url) : parsed.url,
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

  const stream = new ReadableStream<Uint8Array>({
    start: async (ctrl) => {
      const send = (event: string, data: unknown) => ctrl.enqueue(encoder.encode(sseEvent(event, data)));

      send("step", { step: "init", status: "running", message: "Starting AI workspace build…" });
      send("result", { module: "run", data: { runId } });

      const sentModules = new Set<string>();
      const stepStatus = new Map<string, string>();

      const emitStep = (key: string, status: "pending" | "running" | "complete" | "failed", message: string) => {
        const prev = stepStatus.get(key);
        if (prev === status) return;
        stepStatus.set(key, status);
        send("step", { step: key, status, message });
      };

      const emitModule = (module: string, data: unknown) => {
        if (sentModules.has(module)) return;
        sentModules.add(module);
        send("result", { module, data });
      };

      try {
        while (!controller.signal.aborted) {
          const snap = await fetchRunSnapshot(admin, runId!);

          const runStatus = String(snap.run.status ?? "pending");
          const currentStage = snap.run.current_stage ? String(snap.run.current_stage) : null;
          const bundle = snap.workspaceDisplay;

          // Stage-driven progress
          const stages = (snap.stages ?? []) as any[];
          const st = (k: string) => String(stages.find((x) => String(x.stage_key) === k)?.status ?? "pending");

          emitStep("research", st("research") === "running" ? "running" : st("research") === "completed" ? "complete" : st("research") === "failed" ? "failed" : "pending", "Researching offer…");
          emitStep("campaign", bundle?.campaign ? "complete" : currentStage === "strategy" ? "running" : "pending", bundle?.campaign ? "Campaign created" : "Creating campaign…");
          emitStep("landing", (bundle?.landingPages?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending", (bundle?.landingPages?.length ?? 0) ? "Landing page created" : "Building landing page…");
          emitStep("funnel", (bundle?.funnelSteps?.length ?? 0) ? "complete" : currentStage === "strategy" || currentStage === "creation" ? "running" : "pending", (bundle?.funnelSteps?.length ?? 0) ? "Funnel created" : "Generating funnel…");
          emitStep("content", (bundle?.contentAssets?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending", (bundle?.contentAssets?.length ?? 0) ? "Content generated" : "Creating content…");
          emitStep("ads", (bundle?.adCreatives?.length ?? 0) ? "complete" : currentStage === "creation" ? "running" : "pending", (bundle?.adCreatives?.length ?? 0) ? "Ads created" : "Creating ads…");
          emitStep("emails", (bundle?.emailSequenceSteps?.length ?? 0) ? "complete" : currentStage === "creation" || currentStage === "execution" ? "running" : "pending", (bundle?.emailSequenceSteps?.length ?? 0) ? "Emails created" : "Creating emails…");
          emitStep("lead_capture", (bundle?.leadCaptureForms?.length ?? 0) ? "complete" : currentStage === "execution" ? "running" : "pending", (bundle?.leadCaptureForms?.length ?? 0) ? "Lead capture setup" : "Setting up lead capture…");
          emitStep("analytics", (bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "complete" : currentStage === "execution" || currentStage === "optimization" ? "running" : "pending", (bundle?.analyticsHints?.trackingLinks?.length ?? 0) ? "Analytics initialized" : "Initializing analytics…");
          emitStep("approvals", (bundle?.approvals?.length ?? 0) ? "complete" : currentStage === "execution" ? "running" : "pending", (bundle?.approvals?.length ?? 0) ? "Approvals created" : "Creating approvals…");
          emitStep("logs", (snap.logs?.length ?? 0) ? "complete" : "running", (snap.logs?.length ?? 0) ? "Logs ready" : "Streaming logs…");

          // Results (real data)
          if (bundle?.research) emitModule("research", bundle.research);
          if (bundle?.campaign) emitModule("campaign", bundle.campaign);
          if ((bundle?.landingPages?.length ?? 0) > 0) emitModule("landing", bundle!.landingPages?.[0] ?? null);
          if (bundle?.funnel) emitModule("funnel", { funnel: bundle.funnel, steps: bundle.funnelSteps });
          if ((bundle?.contentAssets?.length ?? 0) > 0) emitModule("content", bundle!.contentAssets);
          if ((bundle?.adCreatives?.length ?? 0) > 0) emitModule("ads", bundle!.adCreatives);
          if ((bundle?.emailSequenceSteps?.length ?? 0) > 0) emitModule("emails", { steps: bundle!.emailSequenceSteps, templates: bundle!.emailTemplates });
          if ((bundle?.leadCaptureForms?.length ?? 0) > 0) emitModule("leadCapture", bundle!.leadCaptureForms);
          if ((bundle?.analyticsHints?.trackingLinks?.length ?? 0) > 0) emitModule("analytics", bundle!.analyticsHints);
          if ((bundle?.approvals?.length ?? 0) > 0) emitModule("approvals", bundle!.approvals);

          // Errors
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

          await sleep(900);
        }

        // Ensure the pipeline promise is observed (so we surface errors in logs)
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }
  return handleStream(request, parsed.data);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = querySchema.safeParse(asRecord(body));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }
  return handleStream(request, parsed.data);
}

