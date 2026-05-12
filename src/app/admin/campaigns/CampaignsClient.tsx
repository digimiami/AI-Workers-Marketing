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

const CampaignType = z.enum(["affiliate", "lead_gen", "internal_test", "client"]);
const CampaignStatus = z.enum(["draft", "active", "paused", "completed"]);

export type Campaign = {
  id: string;
  name: string;
  type: z.infer<typeof CampaignType>;
  status: z.infer<typeof CampaignStatus>;
  target_audience: string | null;
  description: string | null;
  created_at: string;
  funnel_count?: number;
  lead_count?: number;
  content_asset_count?: number;
  analytics_event_count?: number;
};

const createSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  type: CampaignType,
  status: CampaignStatus,
  targetAudience: z.string().optional(),
  description: z.string().optional(),
});

type CampaignFormState = {
  name: string;
  type: z.infer<typeof CampaignType>;
  status: z.infer<typeof CampaignStatus>;
  targetAudience: string;
  description: string;
};

const emptyForm = (): CampaignFormState => ({
  name: "",
  type: "affiliate",
  status: "draft",
  targetAudience: "",
  description: "",
});

export function CampaignsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<CampaignFormState>(emptyForm);
  const [editOpen, setEditOpen] = React.useState(false);
  const [active, setActive] = React.useState<Campaign | null>(null);
  const [edit, setEdit] = React.useState<CampaignFormState>(emptyForm);
  const [orgId, setOrgId] = React.useState(organizationId);

  React.useEffect(() => {
    setOrgId(organizationId);
  }, [organizationId]);

  const orgsQuery = useQuery({
    queryKey: ["my-organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as {
        ok: boolean;
        organizations: Array<{ id: string; name: string; role: string }>;
      };
      return j.organizations ?? [];
    },
  });

  const switchOrg = useMutation({
    mutationFn: async (nextOrgId: string) => {
      const res = await fetch("/api/admin/organizations/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: nextOrgId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      toast.success("Organization switched");
      window.location.reload();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Switch failed"),
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/campaigns?organizationId=${orgId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { ok: boolean; campaigns: Campaign[] };
      return json.campaigns ?? [];
    },
  });

  const campaigns = campaignsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsed = createSchema.parse({
        organizationId: orgId,
        ...form,
      });
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean };
    },
    onSuccess: async () => {
      toast.success("Campaign created");
      setOpen(false);
      setForm(emptyForm());
      await qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create campaign"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("No campaign selected");
      const parsed = createSchema
        .omit({ organizationId: true })
        .partial({ status: true, type: true })
        .parse({
          name: edit.name,
          type: edit.type,
          status: edit.status,
          targetAudience: edit.targetAudience || undefined,
          description: edit.description || undefined,
        });

      const res = await fetch(`/api/admin/campaigns/${active.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          name: parsed.name,
          type: parsed.type,
          status: parsed.status,
          targetAudience: parsed.targetAudience ?? null,
          description: parsed.description ?? null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Campaign updated");
      await qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: { id: string }) => {
      const res = await fetch(`/api/admin/campaigns/${target.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const raw = await res.text();
      let message = raw;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (typeof j.message === "string") message = j.message;
      } catch {
        /* keep body text */
      }
      if (!res.ok) throw new Error(message);
    },
    onSuccess: async (_, target) => {
      toast.success("Campaign deleted");
      if (active?.id === target.id) {
        setEditOpen(false);
        setActive(null);
      }
      await qc.invalidateQueries({ queryKey: ["campaigns", orgId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Create campaigns, attach funnels and workers, and track performance.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-[260px]">
            <div className="text-xs font-medium text-muted-foreground mb-1">Organization</div>
            <Select
              value={orgId}
              onValueChange={(v) => {
                const next = v ?? "";
                setOrgId(next);
                if (next) switchOrg.mutate(next);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {(orgsQuery.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} ({o.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>Create campaign</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New campaign</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="name">
                  Name
                </label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Semrush AI Visibility Test"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, type: CampaignType.parse(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="lead_gen">Lead gen</SelectItem>
                      <SelectItem value="internal_test">Internal test</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, status: CampaignStatus.parse(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="audience">
                  Target audience
                </label>
                <Input
                  id="audience"
                  value={form.targetAudience}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetAudience: e.target.value }))
                  }
                  placeholder="SaaS founders and marketers"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="desc">
                  Description
                </label>
                <Input
                  id="desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Internal test campaign for AI visibility hooks"
                />
              </div>

              <Button
                className="w-full"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : campaignsQuery.isError ? (
            <div className="text-sm text-destructive">
              Failed to load campaigns.
            </div>
          ) : campaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No campaigns yet. Create your first campaign.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Funnels</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow
                    key={c.id}
                    role="button"
                    onClick={() => {
                      setActive(c);
                      setEdit({
                        name: c.name,
                        type: c.type,
                        status: c.status,
                        targetAudience: c.target_audience ?? "",
                        description: c.description ?? "",
                      });
                      setEditOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.type}</TableCell>
                    <TableCell className="text-muted-foreground">{c.status}</TableCell>
                    <TableCell>{c.funnel_count ?? 0}</TableCell>
                    <TableCell>{c.lead_count ?? 0}</TableCell>
                    <TableCell>{c.content_asset_count ?? 0}</TableCell>
                    <TableCell>{c.analytics_event_count ?? 0}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.location.href = `/admin/campaigns/${c.id}/automation`;
                          }}
                        >
                          Automation
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActive(c);
                            setEdit({
                              name: c.name,
                              type: c.type,
                              status: c.status,
                              targetAudience: c.target_audience ?? "",
                              description: c.description ?? "",
                            });
                            setEditOpen(true);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.location.href = `/admin/campaigns/${c.id}`;
                          }}
                        >
                          Details
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            const ok = window.confirm(
                              "Delete this campaign? Blocked if funnels, leads, or content assets are linked.",
                            );
                            if (!ok) return;
                            deleteMutation.mutate({ id: c.id });
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setActive(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit campaign</DialogTitle>
          </DialogHeader>
          {!active ? (
            <p className="text-sm text-muted-foreground">No campaign selected.</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={edit.name} onChange={(e) => setEdit((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={edit.type} onValueChange={(v) => setEdit((f) => ({ ...f, type: CampaignType.parse(v) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="lead_gen">Lead gen</SelectItem>
                      <SelectItem value="internal_test">Internal test</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={edit.status} onValueChange={(v) => setEdit((f) => ({ ...f, status: CampaignStatus.parse(v) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Target audience</label>
                <Input value={edit.targetAudience} onChange={(e) => setEdit((f) => ({ ...f, targetAudience: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input value={edit.description} onChange={(e) => setEdit((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    const ok = window.confirm(
                      "Delete this campaign? This is only allowed if there are no linked funnels/leads/content assets.",
                    );
                    if (!ok) return;
                    if (active) deleteMutation.mutate({ id: active.id });
                  }}
                >
                  Delete
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: deletion is blocked if there are linked funnels, leads, or content assets.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

