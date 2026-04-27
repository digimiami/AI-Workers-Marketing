import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processGrowthOsEvents } from "@/services/growthOs/growthOsEventRunner";

/**
 * Vercel Cron: GET /api/cron/growth-os-events
 * Optional: ?organizationId=<uuid>
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const secret = env.server.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "CRON_SECRET not configured" }, { status: 501 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const orgParsed = organizationId ? z.string().uuid().safeParse(organizationId) : null;
  if (organizationId && !orgParsed?.success) {
    return NextResponse.json({ ok: false, message: "Invalid organizationId" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, message: "SUPABASE_SERVICE_ROLE_KEY required for cron runner" },
      { status: 501 },
    );
  }

  const result = await processGrowthOsEvents(admin, {
    organizationId: orgParsed?.success ? orgParsed.data : undefined,
    limit: 200,
  });

  return NextResponse.json({ ok: true, ...result });
}

