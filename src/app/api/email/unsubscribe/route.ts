import { NextResponse } from "next/server";

import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUnsubscribeToken } from "@/services/email/outboxService";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const parsed = z.string().min(10).safeParse(token);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid token" }, { status: 400 });
  }

  const decoded = parseUnsubscribeToken(parsed.data);
  if (!decoded) {
    return NextResponse.json({ ok: false, message: "Bad token" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Supabase not configured" }, { status: 503 });
  }

  await admin.from("email_unsubscribes" as never).upsert(
    {
      organization_id: decoded.organizationId,
      lead_id: decoded.leadId,
      email: decoded.email.toLowerCase(),
      reason: "user_unsubscribe",
    } as never,
    { onConflict: "organization_id,email" },
  );

  return NextResponse.json({ ok: true });
}

