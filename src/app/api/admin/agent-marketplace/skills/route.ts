import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator, orgIdQuery } from "@/app/api/admin/openclaw/_shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listPlatformSkills,
  upsertPlatformSkill,
} from "@/services/agents-marketplace/skillAdminService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgParsed = orgIdQuery.safeParse({
    organizationId: url.searchParams.get("organizationId"),
  });
  if (!orgParsed.success) {
    return NextResponse.json({ ok: false, message: "organizationId required" }, { status: 400 });
  }
  const ctx = await withOrgOperator(orgParsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const agentSlug = url.searchParams.get("agentSlug") ?? undefined;
  const admin = createSupabaseAdminClient();
  const skills = await listPlatformSkills(admin, { agentSlug });
  return NextResponse.json({ ok: true, skills });
}

const upsertSchema = z.object({
  organizationId: z.string().uuid(),
  skill_key: z.string().min(2),
  name: z.string().min(2),
  category: z.string().min(1),
  description: z.string().optional(),
  markdown: z.string(),
  agent_slug: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  featured: z.boolean().optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const ctx = await withOrgOperator(parsed.data.organizationId);
  if (ctx.error) return ctx.error;

  const admin = createSupabaseAdminClient();
  const skill = await upsertPlatformSkill(admin, {
    skill_key: parsed.data.skill_key,
    name: parsed.data.name,
    category: parsed.data.category,
    description: parsed.data.description ?? "",
    markdown: parsed.data.markdown,
    agent_slug: parsed.data.agent_slug,
    status: parsed.data.status,
    featured: parsed.data.featured,
  });

  return NextResponse.json({ ok: true, skill });
}
