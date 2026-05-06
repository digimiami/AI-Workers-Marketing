"use client";

import * as React from "react";
import { Layers } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VariantRow = {
  id: string;
  variant_key: string;
  angle: string | null;
  selected: boolean;
  funnel_step_id: string | null;
};

export function LandingVariantsResultCard(props: {
  organizationId: string;
  campaignId: string | null;
  className?: string;
}) {
  const cid = props.campaignId;
  const [rows, setRows] = React.useState<VariantRow[]>([]);
  const [landingSlug, setLandingSlug] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workspace/landing-variants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, campaignId: cid, action: "list" }),
      });
      const j = (await res.json()) as { ok?: boolean; variants?: VariantRow[]; landingSlug?: string | null };
      if (j.ok && Array.isArray(j.variants)) setRows(j.variants);
      if (typeof j.landingSlug === "string" && j.landingSlug.trim()) setLandingSlug(j.landingSlug);
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

  if (!cid) return null;

  const labelForKey = (k: string) => {
    if (k === "direct_response") return "V1 · Direct response";
    if (k === "premium_trust") return "V2 · Premium trust";
    if (k === "speed_convenience") return "V3 · Speed / convenience";
    return k;
  };

  return (
    <Card className={cn("border-border/50 bg-card/40 backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-300" />
          <CardTitle className="text-base">Landing variants</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0 text-sm">
        {!rows.length ? (
          <div className="text-xs text-muted-foreground">{loading ? "Loading variants…" : "No variants yet (run pipeline)."}</div>
        ) : (
          <div className="space-y-2">
            {rows.map((v) => {
              const previewHref =
                landingSlug != null ? `/f/${cid}/${encodeURIComponent(landingSlug)}?variant=${encodeURIComponent(v.variant_key)}` : `/f/${cid}`;
              return (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{labelForKey(v.variant_key)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Key: <span className="font-mono">{v.variant_key}</span>
                      {v.selected ? <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-100">selected</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a className={buttonVariants({ size: "sm", variant: "secondary" })} href={previewHref} target="_blank" rel="noreferrer">
                      Preview
                    </a>
                    <Button size="sm" variant="outline" disabled={loading || v.selected} onClick={() => void select(v.id)}>
                      Select winner
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
