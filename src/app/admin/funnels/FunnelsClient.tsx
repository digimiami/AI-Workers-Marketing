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
import { toast } from "sonner";

const FunnelStatus = z.enum(["draft", "active", "paused", "archived"]);

export type FunnelRow = {
  id: string;
  name: string;
  status: z.infer<typeof FunnelStatus>;
  campaign_id: string | null;
  campaign_name: string | null;
  step_count: number;
  created_at: string;
  updated_at: string;
};

export function FunnelsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [campaignId, setCampaignId] = React.useState<string>("");

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
      const j = (await res.json()) as { ok: boolean; funnels: FunnelRow[] };
      return j.funnels ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/funnels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: name.trim(),
          campaign_id: campaignId || null,
          status: "draft",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Funnel created");
      setOpen(false);
      setName("");
      setCampaignId("");
      await qc.invalidateQueries({ queryKey: ["funnels", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const patchMutation = useMutation({
    mutationFn: async (vars: { funnelId: string; status?: z.infer<typeof FunnelStatus> }) => {
      const res = await fetch(`/api/admin/funnels/${vars.funnelId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, status: vars.status }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Funnel updated");
      await qc.invalidateQueries({ queryKey: ["funnels", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const campaigns = campaignsQuery.data ?? [];
  const funnels = funnelsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funnels</h1>
          <p className="text-sm text-muted-foreground">
            Funnels linked to campaigns; step editors ship in a follow-up.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>Create funnel</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New funnel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="funnel-name">
                  Name
                </label>
                <Input
                  id="funnel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Bridge → VSL"
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
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || name.trim().length < 2}
              >
                {createMutation.isPending ? "Saving…" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All funnels</CardTitle>
        </CardHeader>
        <CardContent>
          {funnelsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : funnelsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load funnels.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnels.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-muted-foreground">{f.campaign_name ?? "—"}</TableCell>
                    <TableCell>{f.step_count}</TableCell>
                    <TableCell>
                      <Select
                        value={f.status}
                        onValueChange={(v) => {
                          const s = FunnelStatus.safeParse(v);
                          if (s.success) patchMutation.mutate({ funnelId: f.id, status: s.data });
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["draft", "active", "paused", "archived"] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(f.updated_at).toLocaleString()}
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
