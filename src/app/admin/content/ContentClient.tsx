"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const ContentStatus = z.enum(["draft", "approved", "scheduled", "published", "archived"]);

export type ContentAssetRow = {
  id: string;
  title: string;
  status: z.infer<typeof ContentStatus>;
  campaign_id: string | null;
  funnel_id: string | null;
  campaign_name: string | null;
  funnel_name: string | null;
  created_at: string;
  updated_at: string;
};

export function ContentClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [campaignId, setCampaignId] = React.useState("");
  const [funnelId, setFunnelId] = React.useState("");
  const [script, setScript] = React.useState("");

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; campaigns: { id: string; name: string }[] };
      return j.campaigns ?? [];
    },
  });

  const funnelsQuery = useQuery({
    queryKey: ["funnels", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/funnels?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; funnels: { id: string; name: string }[] };
      return j.funnels ?? [];
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["content-assets", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/content-assets?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; assets: ContentAssetRow[] };
      return j.assets ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/content-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          title: title.trim(),
          campaign_id: campaignId || null,
          funnel_id: funnelId || null,
          status: "draft",
          script_markdown: script.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Content asset created");
      setOpen(false);
      setTitle("");
      setCampaignId("");
      setFunnelId("");
      setScript("");
      await qc.invalidateQueries({ queryKey: ["content-assets", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const patchMutation = useMutation({
    mutationFn: async (vars: { assetId: string; status?: z.infer<typeof ContentStatus> }) => {
      const res = await fetch(`/api/admin/content-assets/${vars.assetId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, status: vars.status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Asset updated");
      await qc.invalidateQueries({ queryKey: ["content-assets", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const campaigns = campaignsQuery.data ?? [];
  const funnels = funnelsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
          <p className="text-sm text-muted-foreground">
            Scripts, captions metadata, and workflow status for each asset.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>New asset</Button>} />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New content asset</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="asset-title">
                  Title
                </label>
                <Input
                  id="asset-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="TikTok hook — AI visibility"
                />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Campaign (optional)</span>
                <Select
                  value={campaignId || "__none__"}
                  onValueChange={(v) => setCampaignId(typeof v === "string" && v !== "__none__" ? v : "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Funnel (optional)</span>
                <Select
                  value={funnelId || "__none__"}
                  onValueChange={(v) => setFunnelId(typeof v === "string" && v !== "__none__" ? v : "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {funnels.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <span className="text-sm font-medium">Script (markdown, optional)</span>
                <Textarea value={script} onChange={(e) => setScript(e.target.value)} rows={5} />
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || title.trim().length < 2}
              >
                {createMutation.isPending ? "Saving…" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {assetsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : assetsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load content.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Funnel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="text-muted-foreground">{a.campaign_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.funnel_name ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={a.status}
                        onValueChange={(v) => {
                          const s = ContentStatus.safeParse(v);
                          if (s.success) patchMutation.mutate({ assetId: a.id, status: s.data });
                        }}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["draft", "approved", "scheduled", "published", "archived"] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.updated_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
