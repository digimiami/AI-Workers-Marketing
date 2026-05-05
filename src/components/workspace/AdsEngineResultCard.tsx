"use client";

import * as React from "react";
import { Rocket, PauseCircle, Wand2, Gauge, Settings2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Platform = "meta" | "google" | "tiktok";
type Objective = "leads" | "traffic" | "conversions";
type Status = "draft" | "running" | "paused";

type AdsEngine = {
  platform: Platform;
  daily_budget: number;
  objective: Objective;
  status: Status;
  autopilot: boolean;
  landing_url?: string;
  updated_at?: string;
};

export function AdsEngineResultCard(props: {
  organizationId: string;
  campaignId: string | null;
  active: boolean;
  onStreamHint?: (msg: string) => void;
  className?: string;
}) {
  const cid = props.campaignId;
  const [loading, setLoading] = React.useState(false);
  const [engine, setEngine] = React.useState<AdsEngine | null>(null);
  const [adCreativeCount, setAdCreativeCount] = React.useState<number>(0);

  const fetchState = React.useCallback(async () => {
    if (!cid) return;
    const res = await fetch("/api/workspace/ads-engine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: props.organizationId,
        campaignId: cid,
        action: "get",
      }),
    });
    if (!res.ok) return;
    const j = (await res.json()) as { ok: boolean; adsEngine: AdsEngine; counts?: { ad_creatives?: number } };
    if (!j.ok) return;
    setEngine(j.adsEngine);
    setAdCreativeCount(j.counts?.ad_creatives ?? 0);
  }, [cid, props.organizationId]);

  React.useEffect(() => {
    void fetchState();
  }, [fetchState]);

  const patch = React.useCallback(
    async (settings: Partial<{ platform: Platform; dailyBudget: number; objective: Objective; autopilot: boolean }>) => {
      if (!cid) return;
      setLoading(true);
      try {
        const res = await fetch("/api/workspace/ads-engine", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: props.organizationId,
            campaignId: cid,
            action: "update_settings",
            settings,
          }),
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; adsEngine?: AdsEngine; message?: string };
        if (!res.ok) throw new Error(j?.message ?? "Update failed");
        if (j.adsEngine) setEngine(j.adsEngine);
      } finally {
        setLoading(false);
      }
    },
    [cid, props.organizationId],
  );

  const runAction = React.useCallback(
    async (action: "generate" | "launch" | "pause" | "tick_autopilot", streamHint: string) => {
      if (!cid) return;
      setLoading(true);
      props.onStreamHint?.(streamHint);
      try {
        const res = await fetch("/api/workspace/ads-engine", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId: props.organizationId,
            campaignId: cid,
            action,
          }),
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; message?: string };
        if (!res.ok) throw new Error(j?.message ?? "Action failed");
        await fetchState();
      } finally {
        setLoading(false);
      }
    },
    [cid, fetchState, props],
  );

  if (!cid) return null;
  const e = engine;
  const status = e?.status ?? "draft";
  const pill =
    status === "running"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
      : status === "paused"
        ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
        : "border-border/60 bg-muted/20 text-muted-foreground";

  return (
    <Card className={cn("border-border/50 bg-card/40 shadow-[0_0_28px_-12px_rgba(251,146,60,0.18)] backdrop-blur-xl", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-orange-400" />
            <CardTitle className="text-base">Ads Engine</CardTitle>
          </div>
          <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", pill)}>{status}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Platform</Label>
            <Select
              value={(e?.platform ?? "meta") as Platform}
              onValueChange={(v) => void patch({ platform: v as Platform })}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Daily budget</Label>
            <div className="flex items-center gap-2">
              <Input
                value={String(e?.daily_budget ?? 25)}
                onChange={(ev) => {
                  const n = Number(ev.target.value || "0");
                  if (!Number.isFinite(n)) return;
                  setEngine((prev) => (prev ? { ...prev, daily_budget: n } : prev));
                }}
                onBlur={() => void patch({ dailyBudget: Number(e?.daily_budget ?? 25) })}
                className="h-8"
                inputMode="numeric"
              />
              <span className="text-xs text-muted-foreground">/ day</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Objective</Label>
            <Select
              value={(e?.objective ?? "leads") as Objective}
              onValueChange={(v) => void patch({ objective: v as Objective })}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="traffic">Traffic</SelectItem>
                <SelectItem value="conversions">Conversions</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/10 p-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              Creatives: <span className="text-foreground/90">{adCreativeCount}</span>
              {e?.landing_url ? (
                <>
                  {" "}
                  · Landing: <span className="font-mono text-[11px] text-foreground/80">{e.landing_url}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Autopilot</span>
            <Switch
              checked={Boolean(e?.autopilot)}
              onCheckedChange={(v) => void patch({ autopilot: Boolean(v) })}
              size="sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => void runAction("generate", "→ creating ads")}
            className="gap-2"
          >
            <Wand2 className="h-4 w-4" />
            Generate ads
          </Button>
          <Button
            size="sm"
            disabled={loading || status === "running"}
            onClick={() => void runAction("launch", "→ launching campaign")}
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            Simulate launch
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || status !== "running"}
            onClick={() => void runAction("pause", "✓ campaign paused")}
            className="gap-2"
          >
            <PauseCircle className="h-4 w-4" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading || !e?.autopilot}
            onClick={() => void runAction("tick_autopilot", "→ optimizing ads (autopilot)")}
          >
            Autopilot tick
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

