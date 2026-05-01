import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const demoSchema = z.object({
  businessType: z.string().min(2).max(120),
  offer: z.string().min(2).max(200),
  audience: z.string().min(2).max(200),
  trafficGoal: z.string().min(2).max(800),
});

function inferFunnelType(goal: string) {
  const g = goal.toLowerCase();
  if (g.includes("call") || g.includes("appointment") || g.includes("book")) return "Booked-call funnel";
  if (g.includes("affiliate") || g.includes("click")) return "Affiliate bridge funnel";
  if (g.includes("webinar") || g.includes("training")) return "Registration funnel";
  return "Lead magnet funnel";
}

function buildRecommendation(input: z.infer<typeof demoSchema>) {
  const funnelType = inferFunnelType(input.trafficGoal);
  return {
    funnelType,
    contentAngles: [
      `Problem-aware hook for ${input.audience}`,
      `${input.offer} proof or teardown angle`,
      `Comparison angle for ${input.businessType} buyers`,
    ],
    recommendedWorkers: [
      "Opportunity Scout",
      "Funnel Architect",
      "Content Strategist",
      "Lead Nurture Worker",
    ],
    nextStep:
      funnelType === "Booked-call funnel"
        ? "Build a short qualifier form, route qualified leads to booking, and trigger a 3-email reminder sequence."
        : "Create the first landing step, capture email before the full recommendation, and attach analytics events.",
  };
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = demoSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid request" }, { status: 400 });
  }

  const recommendation = buildRecommendation(parsed.data);

  const organizationId = env.server.PUBLIC_LEAD_ORGANIZATION_ID;
  if (organizationId) {
    try {
      const admin = createSupabaseAdminClient();
      await admin.from("analytics_events" as never).insert({
        organization_id: organizationId,
        campaign_id: env.server.PUBLIC_LEAD_CAMPAIGN_ID ?? null,
        event_name: "demo_recommendation_generated",
        source: "public.demo",
        metadata: {
          input: parsed.data,
          recommendation,
        },
      } as never);
    } catch {
      // The demo should still return a recommendation if telemetry is unavailable.
    }
  }

  return NextResponse.json({ ok: true, recommendation });
}
