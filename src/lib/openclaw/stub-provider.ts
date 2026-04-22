import type { ExecuteContext, OpenClawProvider, OpenClawProviderResult } from "@/lib/openclaw/types";
import { executeOpenClawTool } from "@/lib/openclaw/tools/executor";

/** Local execution when OpenClaw HTTP is unavailable; still writes structured outputs via orchestration. */
export class OpenClawStubProvider implements OpenClawProvider {
  readonly id = "stub" as const;

  async healthCheck() {
    return { ok: true, message: "stub" };
  }

  async executeRun(ctx: ExecuteContext): Promise<OpenClawProviderResult> {
    const roleMode =
      ctx.agentKey === "campaign_launcher"
        ? "campaign_launcher"
        : ctx.agentKey === "offer_analyst"
          ? "offer_analyst"
          : ctx.agentKey === "funnel_architect"
            ? "funnel_architect"
            : ctx.agentKey === "content_strategist"
              ? "content_strategist"
              : ctx.agentKey === "lead_nurture_worker"
                ? "lead_nurture_worker"
                : ctx.agentKey === "analyst_worker"
                  ? "analyst"
                  : "supervisor";

    const callTool = async (tool_name: string, input: Record<string, unknown>) => {
      const result = await executeOpenClawTool({
        organization_id: ctx.organizationId,
        trace_id: ctx.traceId,
        role_mode: roleMode,
        approval_mode: "auto",
        actor: { type: "user", user_id: ctx.actorUserId },
        campaign_id: ctx.campaignId,
        agent_id: null,
        run_id: ctx.runId,
        tool_name,
        input,
      });
      if (!result.success) return { ok: false as const, error: result.error, tool: tool_name };
      return { ok: true as const, data: result.data, tool: tool_name };
    };

    // Campaign Launcher: create durable draft records via internal tools.
    if (ctx.agentKey === "campaign_launcher") {
      const affiliate = String(ctx.input.affiliate_link ?? ctx.input.affiliateLink ?? "");
      const niche = String(ctx.input.niche ?? "Campaign");
      const audience = String(ctx.input.target_audience ?? ctx.input.targetAudience ?? "");
      const traffic = String(ctx.input.traffic_source ?? ctx.input.trafficSource ?? "web");
      const goal = String(ctx.input.campaign_goal ?? ctx.input.campaignGoal ?? "draft");
      const notes = String(ctx.input.notes ?? "");

      const campaignRes = await callTool("create_campaign", {
        organizationId: ctx.organizationId,
        name: `${niche} · ${traffic} · ${goal}`.slice(0, 80),
        type: "affiliate",
        status: "draft",
        target_audience: audience || null,
        description: notes || null,
        metadata: {
          launcher: { affiliate_link: affiliate, niche, traffic_source: traffic, campaign_goal: goal },
          trace_id: ctx.traceId,
        },
      });
      if (!campaignRes.ok) {
        return {
          ok: false,
          errorMessage: `${campaignRes.tool}: ${campaignRes.error.code}`,
          raw: campaignRes,
        };
      }
      const campaign = campaignRes.data as any;

      const funnelRes = await callTool("create_funnel", {
        organizationId: ctx.organizationId,
        name: `${niche} Funnel`.slice(0, 80),
        campaign_id: campaign.id,
        status: "draft",
        metadata: { trace_id: ctx.traceId },
      });
      if (!funnelRes.ok) {
        return {
          ok: false,
          errorMessage: `${funnelRes.tool}: ${funnelRes.error.code}`,
          raw: funnelRes,
        };
      }
      const funnel = funnelRes.data as any;

      const steps: any[] = [];
      for (const s of [
        { name: "Landing page", step_type: "landing", slug: "landing" },
        { name: "Bridge page", step_type: "bridge", slug: "bridge" },
        { name: "Thank you", step_type: "thank_you", slug: "thanks" },
      ]) {
        const r = await callTool("add_funnel_step", {
          organizationId: ctx.organizationId,
          funnel_id: funnel.id,
          name: s.name,
          step_type: s.step_type,
          slug: `${String(niche).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}-${s.slug}`.replace(
            /^-+|-+$/g,
            "",
          ),
        });
        if (r.ok) steps.push(r.data);
      }

      const contentAssets: any[] = [];
      for (const c of [
        { title: `Landing copy · ${niche}`, kind: "landing_copy" },
        { title: `Bridge copy · ${niche}`, kind: "bridge_copy" },
        { title: `Lead magnet concept · ${niche}`, kind: "lead_magnet" },
        { title: `Content batch · ${niche}`, kind: "content_batch" },
      ]) {
        const r = await callTool("create_content_asset", {
          organizationId: ctx.organizationId,
          title: c.title.slice(0, 120),
          platform: c.kind === "content_batch" ? traffic : "web",
          status: "draft",
          campaign_id: campaign.id,
          funnel_id: funnel.id,
          hook: `Draft: ${c.kind}`,
          body: `Draft created by stub provider.\n\nAffiliate: ${affiliate}\nAudience: ${audience}\nTraffic: ${traffic}\nGoal: ${goal}\n\nEdit before use.`,
          metadata: { trace_id: ctx.traceId, kind: c.kind },
        });
        if (r.ok) contentAssets.push(r.data);
      }

      const structuredOutputs = [
        {
          outputType: "openclaw.campaign_launcher.created",
          content: {
            trace_id: ctx.traceId,
            campaign,
            funnel,
            funnel_steps: steps,
            content_assets: contentAssets,
            note: "Stub provider created draft records via internal tools. No publishing performed.",
          },
        },
      ];
      return {
        ok: true,
        summary: `Campaign draft created: ${campaign.name}`,
        structuredOutputs,
        raw: { provider: "stub", roleMode, traceId: ctx.traceId },
      };
    }

    // Default: disciplined placeholder output (no side effects).
    return {
      ok: true,
      summary: `Stub run completed for ${ctx.agentName} (${ctx.agentKey})`,
      structuredOutputs: [
        {
          outputType: "openclaw.operator_summary",
          content: {
            agentKey: ctx.agentKey,
            mission: "Stub mode: provide structured operator output; no external integrations.",
            assumptions: [],
            next_actions: [],
            input: ctx.input,
          },
        },
      ],
      raw: { provider: "stub", runId: ctx.runId, traceId: ctx.traceId },
    };
  }
}
