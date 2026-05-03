import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export type WorkerRunParams = {
  organizationId: string;
  campaignId: string | null;
  pipelineRunId: string;
  stageKey: string;
  workerKey: string;
  actorUserId: string;
  provider: "openclaw" | "internal_llm" | "hybrid";
  input: Record<string, unknown>;
  schemaHint: string;
  prompt: string;
  fallback: Record<string, unknown>;
};

function nowIso() {
  return new Date().toISOString();
}

function titleCaseWorkerKey(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Marketing OS worker keys (e.g. offer_analyst) are not always in OPENCLAW_AGENT_REGISTRY; ensure a real FK row exists. */
async function ensureAgentIdForWorkerKey(
  admin: SupabaseClient,
  organizationId: string,
  workerKey: string,
): Promise<string> {
  const { data: existing, error: selErr } = await admin
    .from("agents" as never)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("key", workerKey)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);
  if (existing) return String((existing as { id: string }).id);

  const name = titleCaseWorkerKey(workerKey);
  const { data: upserted, error: upErr } = await admin
    .from("agents" as never)
    .upsert(
      {
        organization_id: organizationId,
        key: workerKey,
        name: name || workerKey,
        description: "Marketing pipeline worker (auto-provisioned for this organization).",
        status: "enabled",
        approval_required: false,
        allowed_tools: [],
        input_schema: {},
        output_schema: {},
      } as never,
      { onConflict: "organization_id,key" },
    )
    .select("id")
    .single();

  if (upErr || !upserted) {
    const { data: again } = await admin
      .from("agents" as never)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("key", workerKey)
      .maybeSingle();
    if (again) return String((again as { id: string }).id);
    throw new Error(upErr?.message ?? "Failed to provision pipeline worker agent");
  }
  return String((upserted as { id: string }).id);
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return null;
}

async function maybeInternalLlmJson(params: {
  provider: WorkerRunParams["provider"];
  prompt: string;
  schemaHint: string;
  fallback: Record<string, unknown>;
}) {
  const provider = env.server.INTERNAL_LLM_PROVIDER;
  const apiKey = env.server.INTERNAL_LLM_API_KEY;
  const model = env.server.INTERNAL_LLM_MODEL;
  const baseUrl = (env.server.INTERNAL_LLM_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");

  const wantsLlm = params.provider === "internal_llm" || params.provider === "hybrid";
  if (!wantsLlm || provider !== "openai" || !apiKey || !model) {
    return {
      json: params.fallback,
      meta: {
        used: false,
        provider: "fallback",
        model: model ?? undefined,
        baseUrl,
        reason: !wantsLlm
          ? "Provider does not request internal_llm"
          : provider !== "openai"
            ? "INTERNAL_LLM_PROVIDER is not 'openai'"
            : !apiKey
              ? "Missing INTERNAL_LLM_API_KEY"
              : "Missing INTERNAL_LLM_MODEL",
      },
    };
  }

  const systemPrompt = "Return ONLY valid JSON. No markdown.";
  const userPrompt = JSON.stringify({ task: "Worker output JSON", schema_hint: params.schemaHint, prompt: params.prompt }, null, 2);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (e) {
    return { json: params.fallback, meta: { used: false, provider: "fallback", model, baseUrl, reason: `Fetch failed: ${e instanceof Error ? e.message : String(e)}` } };
  }

  if (!response.ok) {
    return { json: params.fallback, meta: { used: false, provider: "fallback", model, baseUrl, httpStatus: response.status, reason: `OpenAI HTTP ${response.status}` } };
  }

  const payload = (await response.json().catch(() => null)) as any;
  const text = String(payload?.choices?.[0]?.message?.content ?? "");
  const jsonText = extractJsonObject(text);
  if (!jsonText) return { json: params.fallback, meta: { used: false, provider: "fallback", model, baseUrl, reason: "No JSON in response" } };
  try {
    return { json: JSON.parse(jsonText) as Record<string, unknown>, meta: { used: true, provider: "openai", model, baseUrl } };
  } catch (e) {
    return { json: params.fallback, meta: { used: false, provider: "fallback", model, baseUrl, reason: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` } };
  }
}

export async function runWorkerAndPersist(params: WorkerRunParams): Promise<{
  runId: string;
  ok: boolean;
  output: Record<string, unknown>;
  meta: Record<string, unknown>;
}> {
  const admin = createSupabaseAdminClient();

  const agentId = await ensureAgentIdForWorkerKey(admin, params.organizationId, params.workerKey);

  const { data: run, error: runErr } = await admin
    .from("agent_runs" as never)
    .insert({
      organization_id: params.organizationId,
      agent_id: agentId,
      campaign_id: params.campaignId,
      status: "running",
      input: {
        pipeline_run_id: params.pipelineRunId,
        stage: params.stageKey,
        worker_key: params.workerKey,
        provider: params.provider,
        input: params.input,
      },
      started_at: nowIso(),
    } as never)
    .select("id")
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? "Failed to create agent run");
  const runId = String((run as any).id);

  const log = async (level: "info" | "error", message: string, data?: Record<string, unknown>) => {
    await admin.from("agent_logs" as never).insert({
      organization_id: params.organizationId,
      run_id: runId,
      level,
      message,
      data: data ?? {},
    } as never);
  };

  try {
    await log("info", "Worker started", { worker: params.workerKey, stage: params.stageKey });
    const res = await maybeInternalLlmJson({
      provider: params.provider,
      prompt: params.prompt,
      schemaHint: params.schemaHint,
      fallback: params.fallback,
    });
    const output = res.json;
    await admin.from("agent_outputs" as never).insert({
      organization_id: params.organizationId,
      run_id: runId,
      output_type: `worker.${params.workerKey}`,
      content: {
        worker_key: params.workerKey,
        stage: params.stageKey,
        pipeline_run_id: params.pipelineRunId,
        output,
        meta: res.meta,
      },
    } as never);
    await log("info", "Worker finished", { ok: true });
    await admin
      .from("agent_runs" as never)
      .update({
        status: "success",
        finished_at: nowIso(),
        output_summary: `${params.workerKey} completed`,
      } as never)
      .eq("organization_id", params.organizationId)
      .eq("id", runId);

    return { runId, ok: true, output, meta: res.meta };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Worker failed";
    await log("error", "Worker failed", { error: msg });
    await admin
      .from("agent_runs" as never)
      .update({
        status: "failed",
        finished_at: nowIso(),
        error_message: msg,
      } as never)
      .eq("organization_id", params.organizationId)
      .eq("id", runId);
    return { runId, ok: false, output: params.fallback, meta: { used: false, provider: "fallback", reason: msg } };
  }
}

