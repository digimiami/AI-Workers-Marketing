import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgOperator } from "@/app/api/admin/openclaw/_shared";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCatalogAgent } from "@/services/agents-marketplace/provisionService";

export const runtime = "nodejs";

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  agentSlug: z.string().min(2),
  successPath: z.string().optional(),
  cancelPath: z.string().optional(),
});

function stripeClient() {
  const key = env.server.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

export async function POST(req: Request) {
  const disable = (env.server.BILLING_DISABLE_STRIPE ?? "").toLowerCase();
  if (disable === "1" || disable === "true" || disable === "yes") {
    return NextResponse.json(
      { ok: false, message: "Billing is temporarily disabled. Contact support for manual provisioning." },
      { status: 503 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });
  }

  const orgCtx = await withOrgOperator(parsed.data.organizationId);
  if (orgCtx.error) return orgCtx.error;

  const admin = createSupabaseAdminClient();
  const catalog = await getCatalogAgent(admin, parsed.data.agentSlug);
  if (!catalog) {
    return NextResponse.json({ ok: false, message: "Agent not found in catalog" }, { status: 404 });
  }

  const priceId = catalog.stripe_price_id as string | null;
  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        message: "This agent is not yet available for self-serve checkout. Book a demo to activate.",
        code: "MISSING_STRIPE_PRICE",
      },
      { status: 503 },
    );
  }

  const base = (env.server.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const successUrl = `${base}${parsed.data.successPath ?? "/admin/my-agents"}?agent=${parsed.data.agentSlug}&billing=success`;
  const cancelUrl = `${base}${parsed.data.cancelPath ?? "/admin/my-agents"}?agent=${parsed.data.agentSlug}&billing=cancel`;

  await admin.from("organization_agent_licenses" as never).upsert(
    {
      organization_id: parsed.data.organizationId,
      agent_catalog_slug: parsed.data.agentSlug,
      status: "pending",
      source: "stripe",
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "organization_id,agent_catalog_slug" },
  );

  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: parsed.data.organizationId,
    metadata: {
      organization_id: parsed.data.organizationId,
      user_id: orgCtx.user.id,
      purchase_type: "agent",
      agent_catalog_slug: parsed.data.agentSlug,
    },
    subscription_data: {
      metadata: {
        organization_id: parsed.data.organizationId,
        purchase_type: "agent",
        agent_catalog_slug: parsed.data.agentSlug,
      },
      trial_period_days: Number(catalog.trial_days) > 0 ? Number(catalog.trial_days) : undefined,
    },
  });

  await admin
    .from("organization_agent_licenses" as never)
    .update({
      stripe_checkout_session_id: session.id,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("organization_id", parsed.data.organizationId)
    .eq("agent_catalog_slug", parsed.data.agentSlug);

  return NextResponse.json({ ok: true, checkoutUrl: session.url });
}
