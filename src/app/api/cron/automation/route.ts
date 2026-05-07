import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { processAutomationJobs, enqueueAutomationJob } from "@/services/automation/jobRunner";
import { contentPublisherWorker } from "@/services/automation/contentEngine";
import { autoLaunchAds, autoOptimizeCampaigns, scaleWinners } from "@/services/automation/adsAutoEngine";

export async function GET(request: Request) {
  const secret = env.server.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, message: "CRON_SECRET not configured" }, { status: 501 });
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const orgParsed = organizationId ? z.string().uuid().safeParse(organizationId) : null;
  if (organizationId && !orgParsed?.success) return NextResponse.json({ ok: false, message: "Invalid organizationId" }, { status: 400 });

  const org = orgParsed?.success ? orgParsed.data : undefined;

  // Hourly cron should do useful work even if no explicit queue rows exist yet.
  const [jobs, content, ads, optimize, scale] = await Promise.all([
    processAutomationJobs({ organizationId: org, limit: 20 }),
    contentPublisherWorker({ organizationId: org, limit: 50 }),
    autoLaunchAds({ organizationId: org, limit: 50 }),
    autoOptimizeCampaigns({ organizationId: org, limit: 50 }),
    scaleWinners({ organizationId: org, limit: 50 }),
  ]);

  return NextResponse.json({ ok: true, jobs, content, ads, optimize, scale });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = z
    .object({
      organizationId: z.string().uuid(),
      campaignId: z.string().uuid().optional(),
      type: z.string().min(1),
      payload: z.record(z.string(), z.unknown()).optional(),
    })
    .safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const id = await enqueueAutomationJob({
    organizationId: parsed.data.organizationId,
    campaignId: parsed.data.campaignId ?? null,
    type: parsed.data.type,
    payload: parsed.data.payload ?? {},
  });
  return NextResponse.json({ ok: true, jobId: id });
}

