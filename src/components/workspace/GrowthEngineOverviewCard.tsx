"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CampaignRow = {
  metadata?: Record<string, unknown> | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function GrowthEngineOverviewCard(props: { organizationId: string; campaignId: string | null }) {
  const [campaign, setCampaign] = React.useState<CampaignRow | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!props.campaignId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/workspace/${props.campaignId}?organizationId=${encodeURIComponent(props.organizationId)}`,
          { method: "GET" },
        );
        const json = (await res.json().catch(() => null)) as { ok?: boolean; campaign?: CampaignRow; message?: string };
        if (!res.ok || !json?.ok) throw new Error(json?.message ?? "Failed to load campaign");
        if (!cancelled) setCampaign(json.campaign ?? null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.campaignId, props.organizationId]);

  if (!props.campaignId) return null;

  const ge = asRecord(campaign?.metadata?.growth_engine);
  const routing = asRecord(ge.traffic_routing);
  const tracking = asRecord(ge.tracking);

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Your AI Growth Engine is Live</CardTitle>
        <CardDescription>
          URL → AI funnel → AI ads → routed traffic → leads → optimization loop. Stub-safe by default; live spend stays
          approval-gated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {err ? <div className="text-destructive text-xs">{err}</div> : null}

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Funnel, Auto-Built</div>
          <p className="mt-1 text-muted-foreground">
            Traffic → Landing → Capture → Action → Follow-Up · Optimized for conversion. Ready for traffic.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Landing Variants</div>
          <p className="mt-1 text-muted-foreground">
            We created 3 conversion angles. Pick one or let AI route traffic automatically.
            {typeof ge.selected_variant_key === "string" ? (
              <span className="mt-1 block text-foreground">Selected variant key: {ge.selected_variant_key}</span>
            ) : null}
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Smart Traffic Routing</div>
          <p className="mt-1 text-muted-foreground">
            Mode: {typeof routing.mode === "string" ? routing.mode : "—"} · Rule:{" "}
            {typeof routing.rule === "string" ? routing.rule : "—"}
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Traffic Engine</div>
          <p className="mt-1 text-muted-foreground">
            Launch paid traffic directly into your funnel. AI generates, tests, and improves your ads.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead Pipeline</div>
          <p className="mt-1 text-muted-foreground">
            Track every visitor from click to conversion. AI scores and prioritizes your hottest leads automatically.
          </p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversion Insights</div>
          <p className="mt-1 text-muted-foreground">See what&apos;s working, what&apos;s leaking, and what to fix next.</p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto Optimization</div>
          <p className="mt-1 text-muted-foreground">
            Let AI route traffic, suggest changes, and improve campaigns based on performance. Budget changes remain
            approval-first unless autopilot is explicitly enabled.
          </p>
        </div>

        {typeof tracking.cid === "string" ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-xs text-muted-foreground">
            Tracking cid (rotate per launch as needed): <span className="font-mono text-foreground">{tracking.cid}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
