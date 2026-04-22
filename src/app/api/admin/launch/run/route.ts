import { NextResponse } from "next/server";

import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  affiliate_link: z.string().min(4),
  niche: z.string().min(2),
  target_audience: z.string().min(2),
  traffic_source: z.string().min(2),
  campaign_goal: z.string().min(2),
  notes: z.string().optional(),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

async function insertRunLog(params: {
  organizationId: string;
  runId: string;
  level: "info" | "error";
  message: string;
  data?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("agent_logs" as never).insert({
    organization_id: params.organizationId,
    run_id: params.runId,
    level: params.level,
    message: params.message,
    data: params.data ?? {},
  } as never);
}

async function upsertLauncherAgent(organizationId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("agents" as never)
    .upsert(
      {
        organization_id: organizationId,
        key: "campaign_launcher",
        name: "Campaign Launcher",
        description: "Creates campaign drafts via internal tools.",
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
  if (error || !data) throw new Error(error?.message ?? "Failed to create agent");
  return (data as { id: string }).id;
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const traceId = `trace_${crypto.randomUUID()}`;
  const admin = createSupabaseAdminClient();

  let runId = "";
  try {
    const agentId = await upsertLauncherAgent(parsed.data.organizationId);

    const { data: run, error: runErr } = await admin
      .from("agent_runs" as never)
      .insert({
        organization_id: parsed.data.organizationId,
        agent_id: agentId,
        campaign_id: null,
        status: "running",
        input: {
          trace_id: traceId,
          role_mode: "campaign_launcher",
          affiliate_link: parsed.data.affiliate_link,
          niche: parsed.data.niche,
          target_audience: parsed.data.target_audience,
          traffic_source: parsed.data.traffic_source,
          campaign_goal: parsed.data.campaign_goal,
          notes: parsed.data.notes ?? "",
        },
        started_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    if (runErr || !run) throw new Error(runErr?.message ?? "Failed to create run");
    runId = (run as { id: string }).id;

    await insertRunLog({
      organizationId: parsed.data.organizationId,
      runId,
      level: "info",
      message: "Launcher started",
      data: { traceId },
    });

    const callTool = async <T extends Record<string, unknown>>(tool_name: string, input: T) => {
      const result = await executeOpenClawTool({
        organization_id: parsed.data.organizationId,
        trace_id: traceId,
        role_mode: "campaign_launcher",
        approval_mode: "auto",
        actor: { type: "user", user_id: orgCtx.user.id },
        campaign_id: null,
        agent_id: agentId,
        run_id: runId,
        tool_name,
        input,
      });
      if (!result.success) {
        throw new Error(`${tool_name}: ${result.error.code}`);
      }
      return result.data as any;
    };

    // 1) Campaign
    const campaignName = `${parsed.data.niche} · ${parsed.data.traffic_source} · ${parsed.data.campaign_goal}`.slice(
      0,
      80,
    );
    const campaign = await callTool("create_campaign", {
      organizationId: parsed.data.organizationId,
      name: campaignName,
      type: "affiliate",
      status: "draft",
      target_audience: parsed.data.target_audience,
      description: parsed.data.notes ?? null,
      metadata: {
        launcher: {
          trace_id: traceId,
          affiliate_link: parsed.data.affiliate_link,
          traffic_source: parsed.data.traffic_source,
          campaign_goal: parsed.data.campaign_goal,
          niche: parsed.data.niche,
        },
      },
    });

    // attach campaign_id to run
    await admin
      .from("agent_runs" as never)
      .update({ campaign_id: (campaign as any).id } as never)
      .eq("organization_id", parsed.data.organizationId)
      .eq("id", runId);

    // 2) Funnel + steps
    const funnel = await callTool("create_funnel", {
      organizationId: parsed.data.organizationId,
      name: `${parsed.data.niche} Funnel`.slice(0, 80),
      campaign_id: (campaign as any).id,
      status: "draft",
      metadata: { trace_id: traceId },
    });

    const base = slugify(parsed.data.niche) || "campaign";
    const funnel_steps = [
      await callTool("add_funnel_step", {
        organizationId: parsed.data.organizationId,
        funnel_id: (funnel as any).id,
        name: "Landing page",
        step_type: "landing",
        slug: `${base}-landing`,
      }),
      await callTool("add_funnel_step", {
        organizationId: parsed.data.organizationId,
        funnel_id: (funnel as any).id,
        name: "Bridge page",
        step_type: "bridge",
        slug: `${base}-bridge`,
      }),
      await callTool("add_funnel_step", {
        organizationId: parsed.data.organizationId,
        funnel_id: (funnel as any).id,
        name: "Thank you",
        step_type: "thank_you",
        slug: `${base}-thanks`,
      }),
    ];

    // 3) Content assets (draft-only; no publishing)
    const content_assets = [
      await callTool("create_content_asset", {
        organizationId: parsed.data.organizationId,
        title: `Landing copy · ${parsed.data.niche}`.slice(0, 120),
        platform: "web",
        status: "draft",
        campaign_id: (campaign as any).id,
        funnel_id: (funnel as any).id,
        hook: `Hook ideas for ${parsed.data.target_audience}`,
        body: `Traffic: ${parsed.data.traffic_source}\nGoal: ${parsed.data.campaign_goal}\nAffiliate link: ${parsed.data.affiliate_link}\n\nDraft landing copy outline:\n- Headline\n- Problem\n- Promise\n- Proof\n- CTA`,
        metadata: { trace_id: traceId, kind: "landing_copy" },
      }),
      await callTool("create_content_asset", {
        organizationId: parsed.data.organizationId,
        title: `Bridge copy · ${parsed.data.niche}`.slice(0, 120),
        platform: "web",
        status: "draft",
        campaign_id: (campaign as any).id,
        funnel_id: (funnel as any).id,
        hook: "Bridge positioning",
        body: "Draft bridge page outline:\n- Quick story\n- Mechanism\n- CTA to offer",
        metadata: { trace_id: traceId, kind: "bridge_copy" },
      }),
      await callTool("create_content_asset", {
        organizationId: parsed.data.organizationId,
        title: `Lead magnet concept · ${parsed.data.niche}`.slice(0, 120),
        platform: "web",
        status: "draft",
        campaign_id: (campaign as any).id,
        funnel_id: (funnel as any).id,
        hook: "Lead magnet",
        body: "Draft lead magnet concept:\n- Title\n- Promise\n- Outline\n- Delivery format",
        metadata: { trace_id: traceId, kind: "lead_magnet" },
      }),
      await callTool("create_content_asset", {
        organizationId: parsed.data.organizationId,
        title: `Content batch · ${parsed.data.niche}`.slice(0, 120),
        platform: parsed.data.traffic_source,
        status: "draft",
        campaign_id: (campaign as any).id,
        funnel_id: (funnel as any).id,
        hook: "Batch plan",
        body: "Draft batch:\n- 10 short hooks\n- 3 scripts\n- 3 CTAs\n(Use regenerate for variations.)",
        metadata: { trace_id: traceId, kind: "content_batch" },
      }),
    ];

    // 4) Email templates + sequence (draft only)
    const t1 = await callTool("create_email_template", {
      organizationId: parsed.data.organizationId,
      name: `Welcome · ${parsed.data.niche}`.slice(0, 120),
      subject: `Quick win for ${parsed.data.target_audience}`.slice(0, 120),
      body_markdown: `Here’s a quick win for **${parsed.data.niche}**.\n\n(Review + edit before sending.)`,
      status: "draft",
    });
    const t2 = await callTool("create_email_template", {
      organizationId: parsed.data.organizationId,
      name: `Problem/solution · ${parsed.data.niche}`.slice(0, 120),
      subject: `The hidden reason this fails` ,
      body_markdown: `Let’s fix the core issue.\n\n(Review + edit before sending.)`,
      status: "draft",
    });
    const t3 = await callTool("create_email_template", {
      organizationId: parsed.data.organizationId,
      name: `CTA · ${parsed.data.niche}`.slice(0, 120),
      subject: `If you want the shortcut…`,
      body_markdown: `Here’s the recommended next step.\n\nAffiliate: ${parsed.data.affiliate_link}`,
      status: "draft",
    });

    const sequence = await callTool("create_email_sequence", {
      organizationId: parsed.data.organizationId,
      name: `${parsed.data.niche} Starter Sequence`.slice(0, 120),
      description: `Traffic: ${parsed.data.traffic_source} · Goal: ${parsed.data.campaign_goal}`,
      is_active: false,
    });

    await callTool("add_email_sequence_step", {
      organizationId: parsed.data.organizationId,
      sequence_id: (sequence as any).id,
      template_id: (t1 as any).id,
      delay_minutes: 0,
    });
    await callTool("add_email_sequence_step", {
      organizationId: parsed.data.organizationId,
      sequence_id: (sequence as any).id,
      template_id: (t2 as any).id,
      delay_minutes: 60 * 24,
    });
    await callTool("add_email_sequence_step", {
      organizationId: parsed.data.organizationId,
      sequence_id: (sequence as any).id,
      template_id: (t3 as any).id,
      delay_minutes: 60 * 48,
    });

    // 5) Tracking link
    const link = await callTool("create_tracking_link", {
      organizationId: parsed.data.organizationId,
      destination_url: parsed.data.affiliate_link,
      label: `${parsed.data.niche} · ${parsed.data.traffic_source}`.slice(0, 120),
      campaign_id: (campaign as any).id,
      utm_defaults: {
        utm_source: parsed.data.traffic_source,
        utm_campaign: slugify(parsed.data.niche),
      },
    });

    const review = {
      traceId,
      approvals: {
        campaign: false,
        funnel: false,
        content: false,
        email: false,
        tracking: false,
        review: false,
      },
      campaign: { id: (campaign as any).id, name: (campaign as any).name },
      funnel: { id: (funnel as any).id, name: (funnel as any).name },
      funnel_steps: (funnel_steps as any[]).map((s) => ({
        id: s.id,
        name: s.name,
        step_type: s.step_type,
        slug: s.slug,
      })),
      content_assets: (content_assets as any[]).map((a) => ({ id: a.id, title: a.title, status: a.status })),
      email: {
        sequence: { id: (sequence as any).id, name: (sequence as any).name },
        templates: [t1, t2, t3].map((t: any) => ({
          id: t.id,
          name: t.name,
          subject: t.subject,
          status: t.status,
        })),
      },
      tracking: { link: { id: (link as any).id, destination_url: (link as any).destination_url } },
      notes: parsed.data.notes ?? "",
    };

    await admin.from("agent_outputs" as never).insert({
      organization_id: parsed.data.organizationId,
      run_id: runId,
      output_type: "launch.review",
      content: review,
    } as never);

    await admin
      .from("agent_runs" as never)
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        output_summary: `Generated campaign draft: ${(campaign as any).name}`,
        error_message: null,
      } as never)
      .eq("organization_id", parsed.data.organizationId)
      .eq("id", runId);

    await insertRunLog({
      organizationId: parsed.data.organizationId,
      runId,
      level: "info",
      message: "Launcher finished",
      data: { campaignId: (campaign as any).id, funnelId: (funnel as any).id },
    });

    return NextResponse.json({ ok: true, runId, traceId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Launcher failed";
    if (runId) {
      await insertRunLog({
        organizationId: parsed.data.organizationId,
        runId,
        level: "error",
        message: "Launcher failed",
        data: { error: msg },
      });
      await admin
        .from("agent_runs" as never)
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_message: msg,
        } as never)
        .eq("organization_id", parsed.data.organizationId)
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, message: "Launcher failed" }, { status: 500 });
  }
}

