import { redirect } from "next/navigation";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function FunnelEntryPage(props: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await props.params;
  if (!z.string().uuid().safeParse(campaignId).success) redirect("/");

  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("id,funnel_id")
    .eq("id", campaignId)
    .maybeSingle();

  const funnelId = (camp as any)?.funnel_id ? String((camp as any).funnel_id) : null;
  if (!funnelId) redirect("/");

  const { data: step } = await admin
    .from("funnel_steps" as never)
    .select("slug")
    .eq("funnel_id", funnelId)
    .eq("is_public", true)
    .order("step_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  const slug = (step as any)?.slug ? String((step as any).slug) : null;
  if (!slug) redirect("/");

  redirect(`/f/${campaignId}/${slug}`);
}

