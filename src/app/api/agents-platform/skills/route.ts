import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  listPlatformSkills,
  upsertPlatformSkill,
} from "@/services/agents-marketplace/skillAdminService";

import {
  jsonWithCors,
  optionsResponse,
  withPlatformAdmin,
} from "../_shared";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return optionsResponse(req);
}

export async function GET(req: Request) {
  const gate = withPlatformAdmin(req);
  if (gate.error) return gate.error;

  const url = new URL(req.url);
  const agentSlug = url.searchParams.get("agentSlug") ?? undefined;
  const admin = createSupabaseAdminClient();
  const skills = await listPlatformSkills(admin, { agentSlug });
  return jsonWithCors(req, { ok: true, skills });
}

const upsertSchema = z.object({
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
  const gate = withPlatformAdmin(req);
  if (gate.error) return gate.error;

  const json = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) {
    return jsonWithCors(req, { ok: false, message: "Invalid body" }, { status: 400 });
  }

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

  return jsonWithCors(req, { ok: true, skill });
}
