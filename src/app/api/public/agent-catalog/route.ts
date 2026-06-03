import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const admin = createSupabaseAdminClient();
  const { data: agents, error: agentsErr } = await admin
    .from("agent_catalog" as never)
    .select(
      "slug,title,short_title,tagline,description,monthly_price_cents,trial_days,included_skill_keys,sort_order",
    )
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (agentsErr) {
    return NextResponse.json({ ok: false, message: agentsErr.message }, { status: 500 });
  }

  const { data: skills, error: skillsErr } = await admin
    .from("platform_skills" as never)
    .select("skill_key,name,category,description,rating,featured,agent_slug")
    .eq("status", "published")
    .order("featured", { ascending: false });

  if (skillsErr) {
    return NextResponse.json({ ok: false, message: skillsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, agents: agents ?? [], skills: skills ?? [] });
}
