import Stripe from "stripe";
import { NextResponse } from "next/server";

import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";

export const runtime = "nodejs";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  plan: z.enum(["starter", "pro", "agency"]),
  successPath: z.string().optional(),
  cancelPath: z.string().optional(),
});

function stripeClient() {
  const key = env.server.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

function priceIdForPlan(plan: "starter" | "pro" | "agency") {
  if (plan === "starter") return env.server.STRIPE_PRICE_STARTER;
  if (plan === "pro") return env.server.STRIPE_PRICE_PRO;
  return env.server.STRIPE_PRICE_AGENCY;
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const base = (env.server.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const successUrl = `${base}${parsed.data.successPath ?? "/admin/settings"}?billing=success`;
  const cancelUrl = `${base}${parsed.data.cancelPath ?? "/admin/settings"}?billing=cancel`;

  const price = priceIdForPlan(parsed.data.plan);
  if (!price) return NextResponse.json({ ok: false, message: "Missing Stripe price env for plan" }, { status: 503 });

  const admin = createSupabaseAdminClient();
  const { data: org } = await admin.from("organizations" as never).select("name").eq("id", parsed.data.organizationId).maybeSingle();
  const orgName = String((org as any)?.name ?? "AiWorkers Org");

  // Ensure subscription row exists (plan defaults to free until webhook updates it).
  await admin.from("organization_subscriptions" as never).upsert(
    {
      organization_id: parsed.data.organizationId,
      user_id: orgCtx.user.id,
      plan: "free",
      subscription_status: "inactive",
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id" },
  );

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: parsed.data.organizationId,
    metadata: {
      organization_id: parsed.data.organizationId,
      user_id: orgCtx.user.id,
      plan: parsed.data.plan,
    },
    subscription_data: {
      metadata: {
        organization_id: parsed.data.organizationId,
        user_id: orgCtx.user.id,
        plan: parsed.data.plan,
      },
    },
    customer_email: orgCtx.user.email ?? undefined,
    allow_promotion_codes: true,
  });

  // Record customer_id early if present (may be null until completion).
  if (session.customer && typeof session.customer === "string") {
    await admin
      .from("organization_subscriptions" as never)
      .update({ stripe_customer_id: session.customer, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", parsed.data.organizationId);
  }

  return NextResponse.json({ ok: true, checkoutUrl: session.url, sessionId: session.id, orgName });
}

