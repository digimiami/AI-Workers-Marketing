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

    const brief = {
      mode: String(ctx.input.mode ?? ctx.input.mode ?? ""),
      affiliate_link: String(ctx.input.affiliate_link ?? ctx.input.affiliateLink ?? ""),
      niche: String(ctx.input.niche ?? ""),
      audience: String(ctx.input.target_audience ?? ctx.input.targetAudience ?? ""),
      traffic_source: String(ctx.input.traffic_source ?? ctx.input.trafficSource ?? ""),
      goal: String(ctx.input.campaign_goal ?? ctx.input.campaignGoal ?? ""),
      notes: String(ctx.input.notes ?? ""),
    };

    const provider_mode = "stub";

    const logWorkerRunEvent = async () => {
      await callTool("log_analytics_event", {
        organizationId: ctx.organizationId,
        event_name: "worker_run",
        source: provider_mode,
        campaign_id: ctx.campaignId,
        metadata: { agent_key: ctx.agentKey, run_id: ctx.runId, trace_id: ctx.traceId },
      });
    };

    // Campaign Launcher: create durable draft records via internal tools.
    if (ctx.agentKey === "campaign_launcher") {
      const affiliate = brief.affiliate_link;
      const niche = brief.niche || "Campaign";
      const audience = brief.audience;
      const traffic = brief.traffic_source || "web";
      const goal = brief.goal || "draft";
      const notes = brief.notes;

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
        { title: `Campaign strategy · ${niche}`, kind: "campaign_strategy" },
        { title: `Landing page copy · ${niche}`, kind: "landing_copy" },
        { title: `Bridge page copy · ${niche}`, kind: "bridge_copy" },
        { title: `CTA copy · ${niche}`, kind: "cta_copy" },
        { title: `Lead magnet concept · ${niche}`, kind: "lead_magnet" },
      ]) {
        const body =
          c.kind === "campaign_strategy"
            ? [
                `## Strategy`,
                `- **Niche**: ${niche}`,
                `- **Audience**: ${audience || "(unspecified)"}`,
                `- **Traffic**: ${traffic}`,
                `- **Goal**: ${goal}`,
                ``,
                `## Angle`,
                `Position the offer around a fast “first win” for ${audience || "the buyer"} using ${niche}.`,
                ``,
                `## CTA`,
                `Primary CTA routes to the affiliate link via the tracking redirect.`,
                ``,
                `## Notes`,
                notes || "(none)",
              ].join("\n")
            : c.kind === "landing_copy"
              ? [
                  `# ${niche}: get a first win fast`,
                  ``,
                  `## Headline`,
                  `AI marketing systems for small business owners — without the guesswork.`,
                  ``,
                  `## Subheadline`,
                  `A simple funnel + scripts + follow-up sequence designed for ${traffic}.`,
                  ``,
                  `## CTA`,
                  `Get the playbook →`,
                  ``,
                  `## Bullets`,
                  `- What to post today (10 scripts)`,
                  `- What to say next (5 emails)`,
                  `- What to measure (baseline events)`,
                ].join("\n")
              : c.kind === "bridge_copy"
                ? [
                    `# Why most ${niche} advice fails`,
                    ``,
                    `It’s tactics without a brain. We connect inputs → workers → approvals → telemetry.`,
                    ``,
                    `## Proof mechanism`,
                    `Every output is a record inside your workspace (campaign, funnel, content, email, analytics).`,
                    ``,
                    `## CTA`,
                    `Continue →`,
                  ].join("\n")
                : c.kind === "cta_copy"
                  ? [
                      `## CTA variants`,
                      `1) **Get the AI marketing playbook**`,
                      `2) **See the workflow that compounds**`,
                      `3) **Start with a quick win checklist**`,
                      ``,
                      `Tracking link: ${affiliate || "(missing affiliate link)"}`,
                    ].join("\n")
                  : [
                      `## Lead magnet concept`,
                      `Title: “${niche} Quick Wins for ${audience || "Small Business Owners"}”`,
                      ``,
                      `Includes:`,
                      `- 10 short-form scripts`,
                      `- 5 nurture emails`,
                      `- a simple metrics dashboard starter`,
                    ].join("\n");
        const r = await callTool("create_content_asset", {
          organizationId: ctx.organizationId,
          title: c.title.slice(0, 120),
          platform: c.kind === "content_batch" ? traffic : "web",
          status: "draft",
          campaign_id: campaign.id,
          funnel_id: funnel.id,
          hook: `Generated (${provider_mode}): ${c.kind}`,
          body,
          metadata: { trace_id: ctx.traceId, kind: c.kind },
        });
        if (r.ok) contentAssets.push(r.data);
      }

      // Create 10 short-form scripts (meaningful drafts)
      for (let i = 1; i <= 10; i += 1) {
        const script = await callTool("create_content_asset", {
          organizationId: ctx.organizationId,
          title: `Script ${i} · ${niche}`.slice(0, 120),
          platform: traffic,
          status: "draft",
          campaign_id: campaign.id,
          funnel_id: funnel.id,
          hook: `Hook ${i}: ${audience || "buyers"} want ${niche} without overwhelm`,
          body: [
            `## Script ${i}`,
            `**Hook:** “If you're a ${audience || "small business owner"} trying ${niche}, stop doing this…”`,
            ``,
            `**Problem:** You have tactics but no system.`,
            `**Mechanism:** One brain + workers + approvals + telemetry.`,
            `**CTA:** “Comment ‘BRAIN’ and I’ll send the playbook.” (swap with your funnel CTA)`,
          ].join("\n"),
          metadata: { trace_id: ctx.traceId, kind: "short_form_script", index: i },
        });
        if (script.ok) contentAssets.push(script.data);
      }

      // Create 5 email templates (meaningful drafts) + a sequence if missing
      const templates: any[] = [];
      for (const [idx, subject] of [
        [1, `Welcome: your ${niche} quick win`],
        [2, `The 3-part system (brain → workers → telemetry)`],
        [3, `Scripts you can post today`],
        [4, `How to measure “is this working?”`],
        [5, `Next step (when you’re ready)`],
      ] as Array<[number, string]>) {
        const tpl = await callTool("create_email_template", {
          organizationId: ctx.organizationId,
          name: `Nurture ${idx} · ${niche}`.slice(0, 120),
          subject: subject.slice(0, 120),
          body_markdown: [
            `Hi ${audience || "there"},`,
            ``,
            `Quick note on ${niche}.`,
            ``,
            `**Today’s takeaway:** connect one input → one output → one metric.`,
            ``,
            `If you want the full workflow, here’s the link:`,
            affiliate || "(missing link)",
            ``,
            `— AiWorkers (stub-generated draft; review before sending)`,
          ].join("\n"),
          status: "draft",
        });
        if (tpl.ok) templates.push(tpl.data);
      }
      const seq = await callTool("create_email_sequence", {
        organizationId: ctx.organizationId,
        name: `${niche} nurture`.slice(0, 120),
        description: `Stub-generated sequence for ${audience || "audience"} · Goal: ${goal}`,
        is_active: false,
      });
      if (seq.ok) {
        for (let i = 0; i < Math.min(templates.length, 5); i += 1) {
          await callTool("add_email_sequence_step", {
            organizationId: ctx.organizationId,
            sequence_id: (seq.data as any).id,
            template_id: templates[i].id,
            delay_minutes: i === 0 ? 0 : i * 24 * 60,
          });
        }
      }

      await logWorkerRunEvent();

      const structuredOutputs = [
        {
          outputType: "openclaw.campaign_launcher.created",
          content: {
            trace_id: ctx.traceId,
            provider_mode,
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
        raw: { provider: provider_mode, roleMode, traceId: ctx.traceId },
      };
    }

    // Specialist workers in stub mode: produce structured outputs AND persist/update records via tools.
    if (ctx.agentKey === "offer_analyst") {
      await logWorkerRunEvent();
      return {
        ok: true,
        summary: `Offer brief drafted (${provider_mode})`,
        structuredOutputs: [
          {
            outputType: "openclaw.offer_brief",
            content: {
              provider_mode,
              trace_id: ctx.traceId,
              niche: brief.niche,
              audience: brief.audience,
              traffic_source: brief.traffic_source,
              goal: brief.goal,
              positioning: `For ${brief.audience || "buyers"} who want ${brief.niche}, we provide a simple system that compounds.`,
              angles: [
                "Quick win checklist",
                "One brain operating system",
                "Scripts + follow-up sequence",
              ],
              compliance_risks: ["Avoid guaranteed results claims", "Be specific about what is a draft"],
              recommended_cta: "Get the playbook",
              assumptions: ["Offer details are limited; refine with real product specifics."],
            },
          },
        ],
        raw: { provider: provider_mode, runId: ctx.runId, traceId: ctx.traceId },
      };
    }

    if (ctx.agentKey === "funnel_architect") {
      // Create/update funnel steps by appending “Lead capture” and “CTA” if missing (idempotent-ish: just append).
      await logWorkerRunEvent();
      const funnelId = String((ctx.input as any)?.funnel_id ?? "");
      const createdSteps: any[] = [];
      if (funnelId) {
        for (const s of [
          { name: "Lead capture", step_type: "form", slug: "lead" },
          { name: "Primary CTA", step_type: "cta", slug: "cta" },
        ]) {
          const r = await callTool("add_funnel_step", {
            organizationId: ctx.organizationId,
            funnel_id: funnelId,
            name: s.name,
            step_type: s.step_type,
            slug: `${String(brief.niche || "workspace").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}-${s.slug}`.replace(
              /^-+|-+$/g,
              "",
            ),
            metadata: {
              provider_mode,
              lead_capture: s.step_type === "form"
                ? {
                    endpoint: "/api/leads/capture",
                    organization_id: ctx.organizationId,
                    campaign_id: ctx.campaignId,
                    funnel_id: funnelId,
                  }
                : undefined,
            },
          } as any);
          if (r.ok) createdSteps.push(r.data);
        }
      }
      return {
        ok: true,
        summary: `Funnel draft updated (${provider_mode})`,
        structuredOutputs: [
          {
            outputType: "openclaw.funnel_blueprint",
            content: {
              provider_mode,
              trace_id: ctx.traceId,
              funnel_id: funnelId || null,
              created_steps: createdSteps,
              notes: "Lead capture step includes endpoint metadata for attribution wiring.",
            },
          },
        ],
        raw: { provider: provider_mode, runId: ctx.runId, traceId: ctx.traceId },
      };
    }

    if (ctx.agentKey === "content_strategist") {
      await logWorkerRunEvent();
      const created: any[] = [];
      // Create 10 scripts if campaign has fewer than 10 short_form_script assets.
      for (let i = 1; i <= 10; i += 1) {
        const r = await callTool("create_content_asset", {
          organizationId: ctx.organizationId,
          title: `Short-form script ${i} · ${brief.niche}`.slice(0, 120),
          platform: brief.traffic_source || "social",
          status: "draft",
          campaign_id: ctx.campaignId,
          funnel_id: (ctx.input as any)?.funnel_id ?? null,
          hook: `Hook ${i}: ${brief.audience || "buyers"} — ${brief.niche} without overwhelm`,
          body: `Draft script ${i} (stub). Replace with live generation when OpenClaw HTTP is enabled.`,
          metadata: { provider_mode, trace_id: ctx.traceId, kind: "short_form_script", index: i },
        });
        if (r.ok) created.push(r.data);
      }
      return {
        ok: true,
        summary: `Content batch created (${provider_mode})`,
        structuredOutputs: [
          {
            outputType: "openclaw.content_batch",
            content: { provider_mode, trace_id: ctx.traceId, created_assets: created.map((x) => ({ id: x.id, title: x.title })) },
          },
        ],
        raw: { provider: provider_mode, runId: ctx.runId, traceId: ctx.traceId },
      };
    }

    if (ctx.agentKey === "lead_nurture_worker") {
      await logWorkerRunEvent();
      const templates: any[] = [];
      for (let i = 1; i <= 5; i += 1) {
        const r = await callTool("create_email_template", {
          organizationId: ctx.organizationId,
          name: `Nurture ${i} · ${brief.niche}`.slice(0, 120),
          subject: `(${i}/5) ${brief.niche} for ${brief.audience || "you"}`.slice(0, 120),
          body_markdown: `Draft nurture email ${i} (stub). Review before sending.`,
          status: "draft",
        });
        if (r.ok) templates.push(r.data);
      }
      const seq = await callTool("create_email_sequence", {
        organizationId: ctx.organizationId,
        name: `${brief.niche} nurture`.slice(0, 120),
        description: `Stub nurture sequence · Goal: ${brief.goal}`,
        is_active: false,
      });
      const stepIds: string[] = [];
      if (seq.ok) {
        for (let i = 0; i < templates.length; i += 1) {
          const s = await callTool("add_email_sequence_step", {
            organizationId: ctx.organizationId,
            sequence_id: (seq.data as any).id,
            template_id: templates[i].id,
            delay_minutes: i === 0 ? 0 : i * 24 * 60,
          });
          if (s.ok) stepIds.push(String((s.data as any).id));
        }
      }
      return {
        ok: true,
        summary: `Email nurture drafted (${provider_mode})`,
        structuredOutputs: [
          {
            outputType: "openclaw.nurture_plan",
            content: {
              provider_mode,
              trace_id: ctx.traceId,
              email_sequence_id: (seq.ok ? (seq.data as any).id : null),
              email_template_ids: templates.map((t) => t.id),
              email_sequence_step_ids: stepIds,
              approvals_needed: ["email_sending"],
            },
          },
        ],
        raw: { provider: provider_mode, runId: ctx.runId, traceId: ctx.traceId },
      };
    }

    if (ctx.agentKey === "analyst_worker") {
      await logWorkerRunEvent();
      return {
        ok: true,
        summary: `Baseline analytics recommendations (${provider_mode})`,
        structuredOutputs: [
          {
            outputType: "openclaw.analytics_plan",
            content: {
              provider_mode,
              trace_id: ctx.traceId,
              events: ["page_view", "lead_submit", "cta_click", "affiliate_click", "email_queued", "approval_decision"],
              dashboard_kpis: ["leads", "clicks", "runs", "approvals"],
              notes: "Events are internal analytics_events rows; external providers can be connected later.",
            },
          },
        ],
        raw: { provider: provider_mode, runId: ctx.runId, traceId: ctx.traceId },
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
            provider_mode,
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
