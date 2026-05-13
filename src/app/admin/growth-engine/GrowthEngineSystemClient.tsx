"use client";

import * as React from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Play, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { GrowthSubsystemHealth, GrowthSubsystemStatus } from "@/services/growth/growthSystemStatus";

type CampaignRow = { id: string; name: string };

type StatusResponse = {
  ok: boolean;
  subsystems: GrowthSubsystemStatus[];
  meta?: Record<string, unknown>;
};

function healthStyles(h: GrowthSubsystemHealth) {
  switch (h) {
    case "ok":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
    case "partial":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "blocked":
      return "border-red-500/50 bg-red-500/10 text-red-100";
    default:
      return "border-border/60 bg-muted/20 text-muted-foreground";
  }
}

export function GrowthEngineSystemClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [campaignId, setCampaignId] = React.useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ["admin-campaigns", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; campaigns?: CampaignRow[] };
      if (!j.ok || !j.campaigns) throw new Error("campaigns");
      return j.campaigns;
    },
  });

  React.useEffect(() => {
    const first = campaigns.data?.[0]?.id;
    if (first && !campaignId) setCampaignId(first);
  }, [campaigns.data, campaignId]);

  const status = useQuery({
    queryKey: ["growth-system-status", organizationId, campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const res = await fetch(
        `/api/growth/system-status?organizationId=${organizationId}&campaignId=${campaignId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as StatusResponse;
    },
    enabled: Boolean(campaignId),
  });

  const scoreMut = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("no campaign");
      const res = await fetch("/api/growth/score-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, campaignId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["growth-system-status", organizationId, campaignId] });
    },
  });

  const loopMut = useMutation({
    mutationFn: async () => {
      if (!campaignId) throw new Error("no campaign");
      const res = await fetch("/api/growth/optimization-loop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, campaignId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["growth-system-status", organizationId, campaignId] });
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-cyan-400" />
            Growth Engine · System map
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Live health of each layer from the architecture diagram. Score variants before launch; run the optimization loop after traffic exists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Full gap analysis: <code className="rounded bg-muted px-1 py-0.5">docs/GROWTH_ENGINE_ARCHITECTURE.md</code>
          </span>
        </div>
      </div>

      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Reference diagram</CardTitle>
          <CardDescription>Same asset ships in-repo under docs/assets and as a public static file.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative w-full aspect-[16/10] bg-muted/30">
            <Image
              src="/growth-engine-architecture.png"
              alt="AIWORKERS Growth Engine architecture"
              fill
              className="object-contain"
              sizes="(max-width: 1200px) 100vw, 1100px"
              priority
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campaign scope</CardTitle>
          <CardDescription>Select a campaign to evaluate pipeline health.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2 min-w-[240px]">
            <Label>Campaign</Label>
            <Select
              value={campaignId ?? ""}
              onValueChange={(v) => setCampaignId(v || null)}
              disabled={campaigns.isLoading || !campaigns.data?.length}
            >
              <SelectTrigger>
                <SelectValue placeholder={campaigns.isLoading ? "Loading…" : "Choose campaign"} />
              </SelectTrigger>
              <SelectContent>
                {(campaigns.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!campaignId || scoreMut.isPending}
              onClick={() => scoreMut.mutate()}
            >
              {scoreMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Score variants
            </Button>
            <Button
              type="button"
              disabled={!campaignId || loopMut.isPending}
              onClick={() => loopMut.mutate()}
            >
              {loopMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Run optimization loop
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Refresh status"
              disabled={!campaignId || status.isFetching}
              onClick={() => void status.refetch()}
            >
              <RefreshCw className={cn("h-4 w-4", status.isFetching && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {status.isError ? (
        <p className="text-sm text-destructive">{(status.error as Error).message}</p>
      ) : null}

      {campaignId && status.data?.ok ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {status.data.subsystems.map((s) => (
            <div
              key={s.key}
              className={cn("rounded-xl border px-4 py-3 text-sm", healthStyles(s.health))}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="mt-1 text-xs opacity-90 leading-relaxed">{s.detail}</div>
            </div>
          ))}
        </div>
      ) : campaignId && status.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading subsystem health…</p>
      ) : null}

      {(scoreMut.isError || loopMut.isError) && (
        <p className="text-sm text-destructive">
          {scoreMut.error instanceof Error ? scoreMut.error.message : ""}
          {loopMut.error instanceof Error ? loopMut.error.message : ""}
        </p>
      )}
    </div>
  );
}
