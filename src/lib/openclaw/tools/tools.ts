import { z } from "zod";

import { asMetadataRecord, mergeJsonbRecords } from "@/lib/mergeJsonbRecords";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TOOL_SCHEMAS } from "@/lib/openclaw/tools/registry";
import { zapierCallTool, zapierListTools } from "@/services/zapier/zapierMcp";
import type { AnyToolDef } from "@/lib/openclaw/tools/registry";
import type { OpenClawToolContext } from "@/lib/openclaw/tools/types";

const id = z.string().uuid();

async function requireOrgRow(orgId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("organizations" as never)
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) throw new Error("ORG_NOT_FOUND");
}

async function requireCampaignOrgMatch(organizationId: string, campaignId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("campaigns" as never)
    .select("id")
    .eq("id", campaignId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("CAMPAIGN_NOT_FOUND");
}

async function requireFunnelOrgMatch(organizationId: string, funnelId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("funnels" as never)
    .select("id")
    .eq("id", funnelId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("FUNNEL_NOT_FOUND");
}

export const TOOLS: AnyToolDef[] = [
  {
    name: "zapier_mcp_list_tools",
    description:
      "List available Zapier MCP tools for the configured Zapier MCP server. Requires ZAPIER_MCP_SERVER_URL and ZAPIER_MCP_SECRET on the server.",
    input: z.object({}),
    output: z.object({ tools: z.array(z.any()) }),
    allowedRoles: ["supervisor"],
    async handler() {
      const res = await zapierListTools();
      return { tools: (res as any)?.tools ?? (res as any) };
    },
  },
  {
    name: "zapier_mcp_call_tool",
    description:
      "Call a Zapier MCP tool by name with arguments. Requires ZAPIER_MCP_SERVER_URL and ZAPIER_MCP_SECRET on the server.",
    input: z.object({
      tool_name: z.string().min(1),
      arguments: z.record(z.string(), z.unknown()).default({}),
    }),
    output: z.object({ result: z.any() }),
    allowedRoles: ["supervisor"],
    highRisk: true,
    async handler(_ctx: OpenClawToolContext, input) {
      const result = await zapierCallTool(input.tool_name, input.arguments);
      return { result };
    },
  },
  {
    name: "create_campaign",
    description: "Create a campaign in the current organization.",
    input: TOOL_SCHEMAS.createCampaignIn,
    output: TOOL_SCHEMAS.campaignOut,
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(ctx: OpenClawToolContext, input) {
      await requireOrgRow(input.organizationId);
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("campaigns" as never)
        .insert({
          organization_id: input.organizationId,
          name: input.name,
          type: input.type ?? "affiliate",
          status: input.status ?? "draft",
          target_audience: input.target_audience ?? null,
          description: input.description ?? null,
          metadata: input.metadata ?? {},
        } as never)
        .select("id,name,status,type,organization_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create campaign");
      return data as any;
    },
  },
  {
    name: "update_campaign",
    description:
      "Update campaign fields. When metadata is provided, it is deep-merged into the existing jsonb metadata (partial updates safe).",
    input: z
      .object({
        organizationId: id,
        campaign_id: id,
        name: z.string().min(1).optional(),
        status: z.string().optional(),
        type: z.string().optional(),
        target_audience: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    output: TOOL_SCHEMAS.campaignOut,
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      const admin = createSupabaseAdminClient();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.status !== undefined) patch.status = input.status;
      if (input.type !== undefined) patch.type = input.type;
      if (input.target_audience !== undefined) patch.target_audience = input.target_audience;
      if (input.description !== undefined) patch.description = input.description;

      if (input.metadata !== undefined) {
        const { data: row, error: metaErr } = await admin
          .from("campaigns" as never)
          .select("metadata")
          .eq("organization_id", input.organizationId)
          .eq("id", input.campaign_id)
          .maybeSingle();
        if (metaErr) throw new Error(metaErr.message);
        const prev = asMetadataRecord((row as { metadata?: unknown } | null)?.metadata);
        patch.metadata = mergeJsonbRecords(prev, input.metadata as Record<string, unknown>);
      }

      const { data, error } = await admin
        .from("campaigns" as never)
        .update(patch as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.campaign_id)
        .select("id,name,status,type,organization_id,metadata")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to update campaign");
      return data as any;
    },
  },
  {
    name: "list_campaigns",
    description: "List campaigns for the organization (most recent first).",
    input: z.object({ organizationId: id, limit: z.number().int().min(1).max(200).optional() }),
    output: z.object({
      campaigns: z.array(z.object({ id, name: z.string(), status: z.string(), type: z.string() })),
    }),
    allowedRoles: ["campaign_launcher", "analyst", "supervisor", "funnel_architect"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("campaigns" as never)
        .select("id,name,status,type")
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 50);
      if (error) throw new Error(error.message);
      return { campaigns: (data ?? []) as any };
    },
  },
  {
    name: "get_campaign",
    description: "Get a campaign by id.",
    input: z.object({ organizationId: id, campaign_id: id }),
    output: z.object({
      campaign: z.object({
        id,
        organization_id: id,
        name: z.string(),
        status: z.string(),
        type: z.string(),
        target_audience: z.string().nullable(),
        description: z.string().nullable(),
        metadata: z.record(z.string(), z.unknown()),
      }),
    }),
    allowedRoles: ["campaign_launcher", "analyst", "supervisor", "funnel_architect"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("campaigns" as never)
        .select("id,organization_id,name,status,type,target_audience,description,metadata")
        .eq("organization_id", input.organizationId)
        .eq("id", input.campaign_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("NOT_FOUND");
      return { campaign: data as any };
    },
  },
  {
    name: "archive_campaign",
    description: "Archive a campaign (sets status=archived).",
    input: z.object({ organizationId: id, campaign_id: id }),
    output: z.object({ ok: z.boolean(), campaign_id: id, status: z.string() }),
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("campaigns" as never)
        .update({ status: "archived", updated_at: new Date().toISOString() } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.campaign_id);
      if (error) throw new Error(error.message);
      return { ok: true, campaign_id: input.campaign_id, status: "archived" };
    },
  },
  {
    name: "create_funnel",
    description: "Create a funnel in the current organization.",
    input: TOOL_SCHEMAS.createFunnelIn,
    output: TOOL_SCHEMAS.funnelOut,
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      if (input.campaign_id) await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("funnels" as never)
        .insert({
          organization_id: input.organizationId,
          name: input.name,
          campaign_id: input.campaign_id ?? null,
          status: input.status ?? "draft",
          metadata: input.metadata ?? {},
        } as never)
        .select("id,name,status,campaign_id,organization_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create funnel");
      return data as any;
    },
  },
  {
    name: "update_funnel",
    description: "Update funnel fields.",
    input: z.object({
      organizationId: id,
      funnel_id: id,
      name: z.string().min(1).optional(),
      status: z.string().optional(),
      campaign_id: id.nullish(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
    output: TOOL_SCHEMAS.funnelOut,
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      await requireFunnelOrgMatch(input.organizationId, input.funnel_id);
      if (input.campaign_id) await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.status !== undefined) patch.status = input.status;
      if (input.campaign_id !== undefined) patch.campaign_id = input.campaign_id ?? null;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("funnels" as never)
        .update(patch as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.funnel_id)
        .select("id,name,status,campaign_id,organization_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to update funnel");
      return data as any;
    },
  },
  {
    name: "list_funnels",
    description: "List funnels for the organization.",
    input: z.object({ organizationId: id, limit: z.number().int().min(1).max(200).optional() }),
    output: z.object({
      funnels: z.array(z.object({ id, name: z.string(), status: z.string(), campaign_id: id.nullable() })),
    }),
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("funnels" as never)
        .select("id,name,status,campaign_id")
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 50);
      if (error) throw new Error(error.message);
      return { funnels: (data ?? []) as any };
    },
  },
  {
    name: "get_funnel",
    description: "Get a funnel by id + its steps.",
    input: z.object({ organizationId: id, funnel_id: id }),
    output: z.object({
      funnel: z.object({ id, name: z.string(), status: z.string(), campaign_id: id.nullable() }),
      steps: z.array(z.object({ id, step_index: z.number().int(), name: z.string(), step_type: z.string(), slug: z.string() })),
    }),
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      await requireFunnelOrgMatch(input.organizationId, input.funnel_id);
      const admin = createSupabaseAdminClient();
      const { data: funnel, error: fErr } = await admin
        .from("funnels" as never)
        .select("id,name,status,campaign_id")
        .eq("organization_id", input.organizationId)
        .eq("id", input.funnel_id)
        .single();
      if (fErr || !funnel) throw new Error(fErr?.message ?? "Funnel not found");
      const { data: steps, error: sErr } = await admin
        .from("funnel_steps" as never)
        .select("id,step_index,name,step_type,slug")
        .eq("organization_id", input.organizationId)
        .eq("funnel_id", input.funnel_id)
        .order("step_index", { ascending: true });
      if (sErr) throw new Error(sErr.message);
      return { funnel: funnel as any, steps: (steps ?? []) as any };
    },
  },
  {
    name: "add_funnel_step",
    description: "Append a funnel step at the next index.",
    input: TOOL_SCHEMAS.addFunnelStepIn,
    output: TOOL_SCHEMAS.funnelStepOut,
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      await requireFunnelOrgMatch(input.organizationId, input.funnel_id);
      const admin = createSupabaseAdminClient();
      const { data: last } = await admin
        .from("funnel_steps" as never)
        .select("step_index")
        .eq("organization_id", input.organizationId)
        .eq("funnel_id", input.funnel_id)
        .order("step_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextIndex = ((last as any)?.step_index ?? -1) + 1;
      const { data, error } = await admin
        .from("funnel_steps" as never)
        .insert({
          organization_id: input.organizationId,
          funnel_id: input.funnel_id,
          step_index: nextIndex,
          name: input.name,
          step_type: input.step_type,
          slug: input.slug,
          metadata: input.metadata ?? {},
        } as never)
        .select("id,funnel_id,step_index,name,step_type,slug")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create step");
      return data as any;
    },
  },
  {
    name: "update_funnel_step",
    description: "Update a funnel step by id.",
    input: z.object({
      organizationId: id,
      step_id: id,
      name: z.string().min(1).optional(),
      step_type: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
    output: TOOL_SCHEMAS.funnelStepOut,
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.step_type !== undefined) patch.step_type = input.step_type;
      if (input.slug !== undefined) patch.slug = input.slug;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      const { data, error } = await admin
        .from("funnel_steps" as never)
        .update(patch as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.step_id)
        .select("id,funnel_id,step_index,name,step_type,slug")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to update step");
      return data as any;
    },
  },
  {
    name: "reorder_funnel_steps",
    description: "Reorder funnel steps by providing ordered ids.",
    input: z.object({
      organizationId: id,
      funnel_id: id,
      ordered_step_ids: z.array(id).min(1).max(200),
    }),
    output: z.object({ ok: z.boolean(), funnel_id: id }),
    allowedRoles: ["campaign_launcher", "funnel_architect", "supervisor"],
    async handler(_ctx, input) {
      await requireFunnelOrgMatch(input.organizationId, input.funnel_id);
      const admin = createSupabaseAdminClient();
      // Verify all step ids belong to funnel + org
      const { data: steps, error: sErr } = await admin
        .from("funnel_steps" as never)
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("funnel_id", input.funnel_id)
        .in("id", input.ordered_step_ids);
      if (sErr) throw new Error(sErr.message);
      if ((steps ?? []).length !== input.ordered_step_ids.length) {
        throw new Error("STEP_SET_MISMATCH");
      }
      for (let i = 0; i < input.ordered_step_ids.length; i++) {
        const stepId = input.ordered_step_ids[i];
        const { error } = await admin
          .from("funnel_steps" as never)
          .update({ step_index: i, updated_at: new Date().toISOString() } as never)
          .eq("organization_id", input.organizationId)
          .eq("id", stepId);
        if (error) throw new Error(error.message);
      }
      return { ok: true, funnel_id: input.funnel_id };
    },
  },
  {
    name: "create_content_asset",
    description: "Create a content asset record.",
    input: TOOL_SCHEMAS.createContentIn,
    output: TOOL_SCHEMAS.contentOut,
    allowedRoles: ["campaign_launcher", "content_strategist", "supervisor"],
    async handler(_ctx, input) {
      if (input.campaign_id) await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      if (input.funnel_id) await requireFunnelOrgMatch(input.organizationId, input.funnel_id);
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("content_assets" as never)
        .insert({
          organization_id: input.organizationId,
          title: input.title,
          platform: input.platform ?? null,
          status: input.status ?? "draft",
          campaign_id: input.campaign_id ?? null,
          funnel_id: input.funnel_id ?? null,
          hook: input.hook ?? null,
          body: input.body ?? null,
          metadata: input.metadata ?? {},
        } as never)
        .select("id,title,status,campaign_id,funnel_id,organization_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create content asset");
      return data as any;
    },
  },
  {
    name: "update_content_asset",
    description: "Update content asset fields.",
    input: z.object({
      organizationId: id,
      content_asset_id: id,
      title: z.string().min(1).optional(),
      hook: z.string().nullable().optional(),
      body: z.string().nullable().optional(),
      platform: z.string().nullable().optional(),
      campaign_id: id.nullish(),
      funnel_id: id.nullish(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
    output: TOOL_SCHEMAS.contentOut,
    allowedRoles: ["campaign_launcher", "content_strategist", "supervisor"],
    async handler(_ctx, input) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.hook !== undefined) patch.hook = input.hook;
      if (input.body !== undefined) patch.body = input.body;
      if (input.platform !== undefined) patch.platform = input.platform;
      if (input.campaign_id !== undefined) patch.campaign_id = input.campaign_id ?? null;
      if (input.funnel_id !== undefined) patch.funnel_id = input.funnel_id ?? null;
      if (input.metadata !== undefined) patch.metadata = input.metadata;
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("content_assets" as never)
        .update(patch as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.content_asset_id)
        .select("id,title,status,campaign_id,funnel_id,organization_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to update content");
      return data as any;
    },
  },
  {
    name: "list_content_assets",
    description: "List content assets for the organization.",
    input: z.object({
      organizationId: id,
      limit: z.number().int().min(1).max(200).optional(),
      status: z.string().optional(),
      campaign_id: id.optional(),
    }),
    output: z.object({
      assets: z.array(z.object({ id, title: z.string(), status: z.string(), platform: z.string().nullable().optional() })),
    }),
    allowedRoles: ["campaign_launcher", "content_strategist", "analyst", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      let q = admin
        .from("content_assets" as never)
        .select("id,title,status,platform")
        .eq("organization_id", input.organizationId);
      if (input.status) q = q.eq("status", input.status);
      if (input.campaign_id) q = q.eq("campaign_id", input.campaign_id);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(input.limit ?? 50);
      if (error) throw new Error(error.message);
      return { assets: (data ?? []) as any };
    },
  },
  {
    name: "change_content_status",
    description: "Change content status (publishing is high-risk and may require approval).",
    input: z.object({
      organizationId: id,
      content_asset_id: id,
      status: z.string().min(1),
    }),
    output: z.object({ ok: z.boolean(), content_asset_id: id, status: z.string() }),
    allowedRoles: ["campaign_launcher", "content_strategist", "supervisor"],
    highRisk: true,
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("content_assets" as never)
        .update({ status: input.status, updated_at: new Date().toISOString() } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.content_asset_id);
      if (error) throw new Error(error.message);
      return { ok: true, content_asset_id: input.content_asset_id, status: input.status };
    },
  },
  {
    name: "create_email_template",
    description: "Create an email template.",
    input: TOOL_SCHEMAS.createEmailTemplateIn,
    output: TOOL_SCHEMAS.emailTemplateOut,
    allowedRoles: ["campaign_launcher", "content_strategist", "lead_nurture_worker", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("email_templates" as never)
        .insert({
          organization_id: input.organizationId,
          name: input.name,
          subject: input.subject,
          body_markdown: input.body_markdown,
          status: input.status ?? "draft",
        } as never)
        .select("id,name,subject,status")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create template");
      return data as any;
    },
  },
  {
    name: "update_email_template",
    description: "Update email template fields.",
    input: z.object({
      organizationId: id,
      template_id: id,
      name: z.string().min(1).optional(),
      subject: z.string().min(1).optional(),
      body_markdown: z.string().min(1).optional(),
      status: z.string().optional(),
    }),
    output: TOOL_SCHEMAS.emailTemplateOut,
    allowedRoles: ["campaign_launcher", "content_strategist", "lead_nurture_worker", "supervisor"],
    async handler(_ctx, input) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.name !== undefined) patch.name = input.name;
      if (input.subject !== undefined) patch.subject = input.subject;
      if (input.body_markdown !== undefined) patch.body_markdown = input.body_markdown;
      if (input.status !== undefined) patch.status = input.status;
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("email_templates" as never)
        .update(patch as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.template_id)
        .select("id,name,subject,status")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to update template");
      return data as any;
    },
  },
  {
    name: "create_email_sequence",
    description: "Create an email sequence.",
    input: TOOL_SCHEMAS.createEmailSequenceIn,
    output: TOOL_SCHEMAS.emailSequenceOut,
    allowedRoles: ["campaign_launcher", "lead_nurture_worker", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("email_sequences" as never)
        .insert({
          organization_id: input.organizationId,
          campaign_id: (input as any).campaign_id ?? null,
          name: input.name,
          description: input.description ?? null,
          is_active: input.is_active ?? true,
        } as never)
        .select("id,name,is_active,campaign_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create sequence");
      return data as any;
    },
  },
  {
    name: "add_email_sequence_step",
    description: "Append an email sequence step (requires valid template).",
    input: TOOL_SCHEMAS.addEmailStepIn,
    output: TOOL_SCHEMAS.emailStepOut,
    allowedRoles: ["campaign_launcher", "lead_nurture_worker", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data: seq } = await admin
        .from("email_sequences" as never)
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("id", input.sequence_id)
        .maybeSingle();
      if (!seq) throw new Error("SEQUENCE_NOT_FOUND");
      const { data: tpl } = await admin
        .from("email_templates" as never)
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("id", input.template_id)
        .maybeSingle();
      if (!tpl) throw new Error("TEMPLATE_NOT_FOUND");

      const { data: last } = await admin
        .from("email_sequence_steps" as never)
        .select("step_index")
        .eq("organization_id", input.organizationId)
        .eq("sequence_id", input.sequence_id)
        .order("step_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextIndex = ((last as any)?.step_index ?? -1) + 1;
      const { data, error } = await admin
        .from("email_sequence_steps" as never)
        .insert({
          organization_id: input.organizationId,
          sequence_id: input.sequence_id,
          step_index: nextIndex,
          template_id: input.template_id,
          delay_minutes: input.delay_minutes,
        } as never)
        .select("id,sequence_id,template_id,step_index,delay_minutes")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create sequence step");
      return data as any;
    },
  },
  {
    name: "create_lead",
    description: "Create a lead record.",
    input: TOOL_SCHEMAS.createLeadIn,
    output: TOOL_SCHEMAS.leadOut,
    allowedRoles: ["lead_nurture_worker", "campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("leads" as never)
        .insert({
          organization_id: input.organizationId,
          email: input.email ?? null,
          name: input.name ?? null,
          phone: input.phone ?? null,
          status: input.status ?? "new",
          score: input.score ?? 0,
          campaign_id: input.campaign_id ?? null,
          funnel_id: input.funnel_id ?? null,
          metadata: input.metadata ?? {},
        } as never)
        .select("id,email,status")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create lead");
      return data as any;
    },
  },
  {
    name: "update_lead_status",
    description: "Update lead status/stage.",
    input: z.object({ organizationId: id, lead_id: id, status: z.string().min(1) }),
    output: z.object({ ok: z.boolean(), lead_id: id, status: z.string() }),
    allowedRoles: ["lead_nurture_worker", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("leads" as never)
        .update({ status: input.status, updated_at: new Date().toISOString() } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.lead_id);
      if (error) throw new Error(error.message);
      return { ok: true, lead_id: input.lead_id, status: input.status };
    },
  },
  {
    name: "update_lead_score",
    description: "Update lead score 0-100.",
    input: z.object({ organizationId: id, lead_id: id, score: z.number().int().min(0).max(100) }),
    output: z.object({ ok: z.boolean(), lead_id: id, score: z.number().int() }),
    allowedRoles: ["lead_nurture_worker", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("leads" as never)
        .update({ score: input.score, updated_at: new Date().toISOString() } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.lead_id);
      if (error) throw new Error(error.message);
      return { ok: true, lead_id: input.lead_id, score: input.score };
    },
  },
  {
    name: "list_leads",
    description: "List leads for the organization.",
    input: z.object({ organizationId: id, limit: z.number().int().min(1).max(200).optional() }),
    output: z.object({
      leads: z.array(z.object({ id, email: z.string().nullable(), status: z.string().nullable().optional(), score: z.number().int().nullable().optional() })),
    }),
    allowedRoles: ["lead_nurture_worker", "supervisor", "campaign_launcher"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("leads" as never)
        .select("id,email,status,score")
        .eq("organization_id", input.organizationId)
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 50);
      if (error) throw new Error(error.message);
      return { leads: (data ?? []) as any };
    },
  },
  {
    name: "enroll_lead_in_sequence",
    description: "Enroll a lead in an email sequence (queues email logs).",
    input: z.object({ organizationId: id, lead_id: id, sequence_id: id, actor_user_id: id }),
    output: z.object({ ok: z.boolean(), enrollment_id: id.optional(), queued: z.number().int().optional() }),
    allowedRoles: ["lead_nurture_worker", "campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { enrollLeadInSequence } = await import("@/services/email/enrollmentService");
      const result = await enrollLeadInSequence(admin as any, {
        organizationId: input.organizationId,
        actorUserId: input.actor_user_id,
        leadId: input.lead_id,
        sequenceId: input.sequence_id,
      });
      return {
        ok: true,
        enrollment_id: String((result as any)?.enrollment?.id ?? ""),
        queued: Number((result as any)?.queuedCount ?? 0),
      };
    },
  },
  {
    name: "queue_test_email",
    description: "Queue a test email send (high-risk; should be approval-gated).",
    input: z.object({ organizationId: id, to_email: z.string().email(), subject: z.string().min(1), body_markdown: z.string().min(1) }),
    output: z.object({ ok: z.boolean() }),
    allowedRoles: ["lead_nurture_worker", "supervisor"],
    highRisk: true,
    async handler(_ctx, _input) {
      // Actual provider send is intentionally not executed here.
      return { ok: true };
    },
  },
  {
    name: "create_tracking_link",
    description: "Create an affiliate tracking link.",
    input: z.object({
      organizationId: id,
      destination_url: z.string().url(),
      label: z.string().optional().nullable(),
      campaign_id: id.nullish(),
      offer_id: id.nullish(),
      utm_defaults: z.record(z.string(), z.unknown()).optional(),
    }),
    output: z.object({ id, destination_url: z.string(), campaign_id: id.nullable().optional() }),
    allowedRoles: ["campaign_launcher", "content_strategist", "supervisor"],
    async handler(_ctx, input) {
      if (input.campaign_id) await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("affiliate_links" as never)
        .insert({
          organization_id: input.organizationId,
          offer_id: input.offer_id ?? null,
          campaign_id: input.campaign_id ?? null,
          label: input.label ?? null,
          destination_url: input.destination_url,
          utm_defaults: input.utm_defaults ?? {},
          is_active: true,
        } as never)
        .select("id,destination_url,campaign_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create tracking link");
      return data as any;
    },
  },
  {
    name: "apply_supabase_migrations",
    description:
      "Request applying Supabase migrations (approval-gated). Triggers a GitHub Action that runs `supabase db push` from the repo.",
    input: z.object({
      organizationId: id,
      reason: z.string().min(1).optional(),
    }),
    output: z.object({ ok: z.boolean() }),
    allowedRoles: ["supervisor"],
    highRisk: true,
    async handler(_ctx, _input) {
      // Execution is approval-gated in the tool executor (returns APPROVAL_REQUIRED and creates an approval item).
      return { ok: true };
    },
  },
  {
    name: "log_analytics_event",
    description: "Write an analytics event.",
    input: z.object({
      organizationId: id,
      event_name: z.string().min(1),
      source: z.string().min(1).optional(),
      campaign_id: id.nullish(),
      funnel_id: id.nullish(),
      lead_id: id.nullish(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
    output: z.object({ ok: z.boolean() }),
    allowedRoles: ["analyst", "supervisor", "campaign_launcher"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from("analytics_events" as never).insert({
        organization_id: input.organizationId,
        event_name: input.event_name,
        source: input.source ?? "openclaw",
        campaign_id: input.campaign_id ?? null,
        funnel_id: input.funnel_id ?? null,
        lead_id: input.lead_id ?? null,
        metadata: input.metadata ?? {},
      } as never);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  },
  {
    name: "get_campaign_metrics",
    description: "Get basic aggregated metrics for a campaign (counts by event_name).",
    input: z.object({ organizationId: id, campaign_id: id, days: z.number().int().min(1).max(365).optional() }),
    output: z.object({ metrics: z.record(z.string(), z.number().int()) }),
    allowedRoles: ["analyst", "supervisor", "campaign_launcher"],
    async handler(_ctx, input) {
      await requireCampaignOrgMatch(input.organizationId, input.campaign_id);
      const admin = createSupabaseAdminClient();
      const since = new Date(Date.now() - (input.days ?? 30) * 86400_000).toISOString();
      const { data, error } = await admin
        .from("analytics_events" as never)
        .select("event_name")
        .eq("organization_id", input.organizationId)
        .eq("campaign_id", input.campaign_id)
        .gte("created_at", since)
        .limit(5000);
      if (error) throw new Error(error.message);
      const metrics: Record<string, number> = {};
      for (const r of data ?? []) {
        const name = String((r as any).event_name ?? "unknown");
        metrics[name] = (metrics[name] ?? 0) + 1;
      }
      return { metrics };
    },
  },
  {
    name: "get_org_settings",
    description: "Get org settings (sanitized).",
    input: z.object({ organizationId: id }),
    output: z.object({ settings: z.array(z.object({ key: z.string(), value: z.record(z.string(), z.unknown()) })) }),
    allowedRoles: ["campaign_launcher", "content_strategist", "lead_nurture_worker", "analyst", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("settings" as never)
        .select("key,value")
        .eq("organization_id", input.organizationId)
        .order("key", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return { settings: (data ?? []) as any };
    },
  },
  {
    name: "create_agent_run",
    description: "Create an agent run record (pending).",
    input: TOOL_SCHEMAS.createRunIn,
    output: TOOL_SCHEMAS.createRunOut,
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("agent_runs" as never)
        .insert({
          organization_id: input.organizationId,
          agent_id: input.agent_id,
          campaign_id: input.campaign_id ?? null,
          status: "pending",
          input: input.input ?? {},
        } as never)
        .select("id,status,agent_id,campaign_id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create run");
      return data as any;
    },
  },
  {
    name: "append_agent_run_log",
    description: "Append a log line to an agent run.",
    input: z.object({
      organizationId: id,
      run_id: id,
      level: z.string().default("info"),
      message: z.string().min(1),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
    output: z.object({ ok: z.boolean() }),
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.from("agent_logs" as never).insert({
        organization_id: input.organizationId,
        run_id: input.run_id,
        level: input.level,
        message: input.message,
        data: input.data ?? {},
      } as never);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  },
  {
    name: "complete_agent_run",
    description: "Mark an agent run as success.",
    input: z.object({ organizationId: id, run_id: id, output_summary: z.string().optional().nullable() }),
    output: z.object({ ok: z.boolean() }),
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("agent_runs" as never)
        .update({
          status: "success",
          output_summary: input.output_summary ?? null,
          finished_at: new Date().toISOString(),
          error_message: null,
        } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.run_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  },
  {
    name: "fail_agent_run",
    description: "Mark an agent run as failed.",
    input: z.object({ organizationId: id, run_id: id, error_message: z.string().min(1) }),
    output: z.object({ ok: z.boolean() }),
    allowedRoles: ["campaign_launcher", "supervisor"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { error } = await admin
        .from("agent_runs" as never)
        .update({
          status: "failed",
          error_message: input.error_message,
          finished_at: new Date().toISOString(),
        } as never)
        .eq("organization_id", input.organizationId)
        .eq("id", input.run_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    },
  },
  {
    name: "get_pending_approvals",
    description: "List pending approvals for org.",
    input: z.object({ organizationId: id, limit: z.number().int().min(1).max(200).optional() }),
    output: z.object({
      approvals: z.array(z.object({ id, approval_type: z.string(), status: z.string(), created_at: z.string().optional() })),
    }),
    allowedRoles: ["supervisor", "campaign_launcher"],
    async handler(_ctx, input) {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("approvals" as never)
        .select("id,approval_type,status,created_at")
        .eq("organization_id", input.organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(input.limit ?? 50);
      if (error) throw new Error(error.message);
      return { approvals: (data ?? []) as any };
    },
  },
  {
    name: "create_approval_item",
    description: "Create an approval queue item.",
    input: TOOL_SCHEMAS.createApprovalIn,
    output: TOOL_SCHEMAS.approvalOut,
    allowedRoles: ["campaign_launcher", "content_strategist", "lead_nurture_worker", "supervisor"],
    highRisk: true,
    async handler(_ctx, input) {
      const payload = (input.payload ?? {}) as Record<string, unknown>;
      const target =
        typeof payload.content_asset_id === "string"
          ? { type: "content_asset", id: payload.content_asset_id }
          : typeof payload.template_id === "string"
            ? { type: "email_template", id: payload.template_id }
            : typeof payload.sequence_id === "string"
              ? { type: "email_sequence", id: payload.sequence_id }
              : typeof payload.link_id === "string"
                ? { type: "affiliate_link", id: payload.link_id }
                : typeof payload.funnel_step_id === "string"
                  ? { type: "funnel_step", id: payload.funnel_step_id }
                  : null;
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("approvals" as never)
        .insert({
          organization_id: input.organizationId,
          campaign_id: input.campaign_id ?? null,
          status: "pending",
          approval_type: input.approval_type,
          reason_required: input.reason_required ?? true,
          requested_by_user_id: input.requested_by_user_id ?? null,
          target_entity_type: target?.type ?? null,
          target_entity_id: target?.id ?? null,
          payload,
        } as never)
        .select("id,status,approval_type")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Failed to create approval item");
      return data as any;
    },
  },
];

export function getToolByName(name: string): AnyToolDef | null {
  return TOOLS.find((t) => t.name === name) ?? null;
}

