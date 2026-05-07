import Stripe from "stripe";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function requireStripe() {
  const key = env.server.STRIPE_SECRET_KEY;
  const wh = env.server.STRIPE_WEBHOOK_SECRET;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  if (!wh) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return { stripe: new Stripe(key, { apiVersion: "2026-04-22.dahlia" }), webhookSecret: wh };
}

function asString(v: unknown) {
  return typeof v === "string" ? v : null;
}

export async function POST(req: Request) {
  let stripe: Stripe;
  let webhookSecret: string;
  try {
    ({ stripe, webhookSecret } = requireStripe());
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Stripe not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false, message: "Missing stripe-signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Invalid signature" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // We attribute revenue to organization/campaign via Stripe metadata (set during checkout/session creation).
  // Expected metadata keys (optional but recommended):
  // - organization_id
  // - campaign_id
  // - lead_id
  // - cid (click id)
  const handler = async () => {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = asString(s.metadata?.organization_id);
      const campaignId = asString(s.metadata?.campaign_id);
      const leadId = asString(s.metadata?.lead_id);
      const cid = asString(s.metadata?.cid);
      const plan = asString(s.metadata?.plan);

      const amount = typeof s.amount_total === "number" ? s.amount_total : null;
      const currency = asString(s.currency) ?? "usd";

      // If orgId is missing, still record an analytics event for debugging attribution.
      await admin.from("analytics_events" as never).insert({
        organization_id: orgId,
        campaign_id: campaignId,
        lead_id: leadId,
        event_name: "purchase",
        source: "stripe.webhook",
        properties: {
          stripe_event_id: event.id,
          stripe_session_id: s.id,
          amount_total: amount,
          currency,
          customer_email: s.customer_details?.email ?? null,
          cid,
        },
        created_at: new Date().toISOString(),
      } as never);

      await admin.from("conversions" as never).insert({
        organization_id: orgId,
        campaign_id: campaignId,
        lead_id: leadId,
        conversion_type: "stripe.checkout.session.completed",
        value_cents: amount,
        metadata: {
          stripe_event_id: event.id,
          stripe_session_id: s.id,
          currency,
          cid,
          customer_email: s.customer_details?.email ?? null,
        },
        created_at: new Date().toISOString(),
      } as never);

      // Subscription provisioning (plan/status) for SaaS billing.
      if (orgId && s.subscription && typeof s.subscription === "string") {
        await admin.from("organization_subscriptions" as never).upsert(
          {
            organization_id: orgId,
            user_id: null,
            plan: (plan === "starter" || plan === "pro" || plan === "agency" ? plan : "free") as any,
            subscription_status: "active",
            stripe_customer_id: typeof s.customer === "string" ? s.customer : null,
            stripe_subscription_id: s.subscription,
            current_period_end: null,
            cancel_at_period_end: false,
            metadata: { source: "stripe.checkout.session.completed", stripe_event_id: event.id },
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "organization_id" },
        );
      }
      return;
    }

    if (event.type === "invoice.paid") {
      const inv = event.data.object as Stripe.Invoice;
      const orgId = asString(inv.metadata?.organization_id);
      const campaignId = asString(inv.metadata?.campaign_id);
      const leadId = asString(inv.metadata?.lead_id);
      const cid = asString(inv.metadata?.cid);
      const plan = asString(inv.metadata?.plan);
      const subId = typeof (inv as any).subscription === "string" ? String((inv as any).subscription) : null;

      const amount = typeof inv.amount_paid === "number" ? inv.amount_paid : null;
      const currency = asString(inv.currency) ?? "usd";

      await admin.from("analytics_events" as never).insert({
        organization_id: orgId,
        campaign_id: campaignId,
        lead_id: leadId,
        event_name: "purchase",
        source: "stripe.webhook",
        properties: {
          stripe_event_id: event.id,
          stripe_invoice_id: inv.id,
          amount_paid: amount,
          currency,
          cid,
          customer_email: inv.customer_email ?? null,
        },
        created_at: new Date().toISOString(),
      } as never);

      await admin.from("conversions" as never).insert({
        organization_id: orgId,
        campaign_id: campaignId,
        lead_id: leadId,
        conversion_type: "stripe.invoice.paid",
        value_cents: amount,
        metadata: {
          stripe_event_id: event.id,
          stripe_invoice_id: inv.id,
          currency,
          cid,
          customer_email: inv.customer_email ?? null,
        },
        created_at: new Date().toISOString(),
      } as never);

      // Keep subscription status warm on recurring payments.
      if (orgId && subId) {
        const periodEnd = typeof inv.lines?.data?.[0]?.period?.end === "number" ? new Date(inv.lines.data[0].period.end * 1000).toISOString() : null;
        await admin.from("organization_subscriptions" as never).upsert(
          {
            organization_id: orgId,
            user_id: null,
            plan: (plan === "starter" || plan === "pro" || plan === "agency" ? plan : "free") as any,
            subscription_status: "active",
            stripe_customer_id: typeof inv.customer === "string" ? inv.customer : null,
            stripe_subscription_id: subId,
            current_period_end: periodEnd,
            cancel_at_period_end: Boolean((inv as any).cancel_at_period_end ?? false),
            metadata: { source: "stripe.invoice.paid", stripe_event_id: event.id },
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "organization_id" },
        );
      }
      return;
    }
  };

  try {
    await handler();
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

