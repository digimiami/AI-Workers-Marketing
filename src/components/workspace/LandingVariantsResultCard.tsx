"use client";

import * as React from "react";
import { AlertTriangle, Layers, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VariantPreview = {
  headline: string;
  subheadline: string;
  ctaText: string;
  benefitsCount: number;
};

type VariantRow = {
  id: string;
  variant_key: string;
  angle: string | null;
  selected: boolean;
  funnel_step_id: string | null;
  preview?: VariantPreview;
};

type LandingFix = {
  reason?: string | null;
  detail?: string | null;
  marked_at?: string | null;
};

export function LandingVariantsResultCard(props: {
  organizationId: string;
  campaignId: string | null;
  className?: string;
}) {
  const cid = props.campaignId;
  const [rows, setRows] = React.useState<VariantRow[]>([]);
  const [landingSlug, setLandingSlug] = React.useState<string | null>(null);
  const [landingStatus, setLandingStatus] = React.useState<string | null>(null);
  const [landingFix, setLandingFix] = React.useState<LandingFix | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/landing-variants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, campaignId: cid, action: "list" }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        variants?: VariantRow[];
        landingSlug?: string | null;
        landingStatus?: string | null;
        landingFix?: LandingFix | null;
      };
      if (j.ok && Array.isArray(j.variants)) setRows(j.variants);
      if (typeof j.landingSlug === "string" && j.landingSlug.trim()) setLandingSlug(j.landingSlug);
      setLandingStatus(j.landingStatus ?? null);
      setLandingFix(j.landingFix ?? null);
    } finally {
      setLoading(false);
    }
  }, [cid, props.organizationId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = React.useCallback(
    async (variantId: string) => {
      if (!cid) return;
      setLoading(true);
      try {
        const res = await fetch("/api/workspace/landing-variants", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: props.organizationId, campaignId: cid, action: "select", variantId }),
        });
        if (res.ok) await refresh();
      } finally {
        setLoading(false);
      }
    },
    [cid, props.organizationId, refresh],
  );

  const regenerate = React.useCallback(async () => {
    if (!cid) return;
    setRegenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/workspace/landing-variants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          campaignId: cid,
          action: "regenerate",
        }),
      });
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        reason?: string;
        variantsWritten?: number;
      } | null;
      if (!res.ok || !j?.ok) {
        setErrorMsg(j?.message || `Regeneration failed (${res.status})`);
      }
      await refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }, [cid, props.organizationId, refresh]);

  if (!cid) return null;

  const labelForKey = (k: string) => {
    if (k === "direct_response") return "V1 · Direct response";
    if (k === "premium_trust") return "V2 · Premium trust";
    if (k === "speed_convenience") return "V3 · Speed / convenience";
    return k;
  };

  const needsFix = landingStatus === "needs_generation_fix";
  const fixReasonLabel = (() => {
    const r = landingFix?.reason ?? "";
    if (!r) return "Output failed quality gates";
    if (r === "scrape_failed") return "We couldn't read the URL";
    if (r === "model_unused") return "AI provider returned nothing usable";
    if (r === "banned_phrase") return "Generic / banned phrase detected";
    if (r === "placeholder") return "Scaffolding placeholder text detected";
    if (r === "not_anchored") return "Headline not anchored to your real brand/page";
    if (r === "body_not_anchored") return "Body copy not anchored to scraped content";
    if (r === "missing_variants") return "AI returned no variants";
    if (r === "invalid_shape") return "AI returned an invalid shape";
    return r;
  })();

  return (
    <Card className={cn("border-border/50 bg-card/40 backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-300" />
            <CardTitle className="text-base">Landing variants</CardTitle>
          </div>
          <Button
            size="sm"
            variant={needsFix ? "default" : "outline"}
            disabled={regenerating || loading}
            onClick={() => void regenerate()}
            title="Re-run scrape + AI variant generation with strict quality gates"
          >
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", regenerating ? "animate-spin" : "")} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        {needsFix ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-100">Landing pages need regeneration</div>
              <div className="text-amber-200/80">{fixReasonLabel}</div>
              {landingFix?.detail ? (
                <div className="font-mono text-[10px] text-amber-200/70">{landingFix.detail}</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
            {errorMsg}
          </div>
        ) : null}

        {!rows.length ? (
          <div className="text-xs text-muted-foreground">{loading ? "Loading variants…" : "No variants yet (run pipeline)."}</div>
        ) : (
          <div className="space-y-2">
            {rows.map((v) => {
              const previewHref =
                landingSlug != null ? `/f/${cid}/${encodeURIComponent(landingSlug)}?variant=${encodeURIComponent(v.variant_key)}` : `/f/${cid}`;
              const headline = v.preview?.headline?.trim() ?? "";
              const isEmpty = !headline;
              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-xl border p-3",
                    isEmpty ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-muted/10",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold">{labelForKey(v.variant_key)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Key: <span className="font-mono">{v.variant_key}</span>
                        {v.selected ? (
                          <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">
                            selected
                          </span>
                        ) : null}
                        {isEmpty ? (
                          <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100">
                            empty
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a
                        className={buttonVariants({ size: "sm", variant: "secondary" })}
                        href={previewHref}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Preview
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || v.selected || isEmpty}
                        onClick={() => void select(v.id)}
                      >
                        Select winner
                      </Button>
                    </div>
                  </div>
                  {headline ? (
                    <div className="mt-2 space-y-1 text-xs">
                      <div className="font-semibold leading-snug">{headline}</div>
                      {v.preview?.subheadline ? (
                        <div className="text-muted-foreground">{v.preview.subheadline}</div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        {v.preview?.ctaText ? <span>CTA: {v.preview.ctaText}</span> : null}
                        {v.preview?.benefitsCount ? <span>Benefits: {v.preview.benefitsCount}</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-amber-200/80">
                      No copy stored for this variant — click Regenerate above.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
