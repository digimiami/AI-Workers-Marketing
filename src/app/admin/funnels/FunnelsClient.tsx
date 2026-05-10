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
const StepType = z.enum(["landing", "bridge", "form", "cta", "thank_you", "email_trigger", "other"]);

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

type FunnelStepRow = {
  id: string;
  funnel_id: string;
  step_index: number;
  name: string;
  step_type: z.infer<typeof StepType>;
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export function FunnelsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [campaignId, setCampaignId] = React.useState<string>("");
  const [stepsOpen, setStepsOpen] = React.useState(false);
  const [activeFunnel, setActiveFunnel] = React.useState<FunnelRow | null>(null);
  const [newStep, setNewStep] = React.useState({
    name: "",
    step_type: "landing" as z.infer<typeof StepType>,
    slug: "",
    is_public: true,
  });
  const [funnelNameById, setFunnelNameById] = React.useState<Record<string, string>>({});

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
    mutationFn: async (vars: {
      funnelId: string;
      status?: z.infer<typeof FunnelStatus>;
      name?: string;
    }) => {
      const body: Record<string, unknown> = { organizationId };
      if (vars.status !== undefined) body.status = vars.status;
      if (vars.name !== undefined) body.name = vars.name;
      const res = await fetch(`/api/admin/funnels/${vars.funnelId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
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

  const deleteFunnelMutation = useMutation({
    mutationFn: async (funnelId: string) => {
      const res = await fetch(`/api/admin/funnels/${funnelId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Funnel deleted");
      setStepsOpen(false);
      setActiveFunnel(null);
      await qc.invalidateQueries({ queryKey: ["funnels", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const stepsQuery = useQuery({
    queryKey: ["funnel-steps", organizationId, activeFunnel?.id],
    enabled: Boolean(activeFunnel?.id),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/funnels/${activeFunnel?.id}/steps?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; steps: FunnelStepRow[] };
      return j.steps ?? [];
    },
  });

  const createStep = useMutation({
    mutationFn: async () => {
      if (!activeFunnel) throw new Error("No funnel selected");
      const slug = newStep.slug.trim();
      const res = await fetch("/api/admin/funnel-steps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          funnel_id: activeFunnel.id,
          name: newStep.name.trim(),
          step_type: StepType.parse(newStep.step_type),
          slug,
          is_public: newStep.is_public,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Step created");
      setNewStep({ name: "", step_type: "landing", slug: "", is_public: true });
      await qc.invalidateQueries({ queryKey: ["funnel-steps", organizationId, activeFunnel?.id] });
      await qc.invalidateQueries({ queryKey: ["funnels", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });

  const patchStep = useMutation({
    mutationFn: async (vars: { stepId: string; name?: string; step_type?: string; slug?: string; is_public?: boolean }) => {
      const payload: Record<string, unknown> = { organizationId };
      if (vars.name !== undefined) payload.name = vars.name;
      if (vars.step_type !== undefined) payload.step_type = vars.step_type;
      if (vars.slug !== undefined) payload.slug = vars.slug;
      if (vars.is_public !== undefined) payload.is_public = vars.is_public;

      const res = await fetch(`/api/admin/funnel-steps/${vars.stepId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Step updated");
      await qc.invalidateQueries({ queryKey: ["funnel-steps", organizationId, activeFunnel?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteStep = useMutation({
    mutationFn: async (vars: { stepId: string }) => {
      const res = await fetch(`/api/admin/funnel-steps/${vars.stepId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Step deleted");
      await qc.invalidateQueries({ queryKey: ["funnel-steps", organizationId, activeFunnel?.id] });
      await qc.invalidateQueries({ queryKey: ["funnels", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const reorderSteps = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!activeFunnel) throw new Error("No funnel selected");
      const res = await fetch("/api/admin/funnel-steps/reorder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          funnel_id: activeFunnel.id,
          ordered_step_ids: orderedIds,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Steps reordered");
      await qc.invalidateQueries({ queryKey: ["funnel-steps", organizationId, activeFunnel?.id] });
      await qc.invalidateQueries({ queryKey: ["funnels", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reorder failed"),
  });

  const campaigns = campaignsQuery.data ?? [];
  const funnels = funnelsQuery.data ?? [];
  const steps = stepsQuery.data ?? [];

  React.useEffect(() => {
    setFunnelNameById((prev) => {
      const next = { ...prev };
      for (const f of funnels) {
        if (next[f.id] === undefined) next[f.id] = f.name;
      }
      return next;
    });
  }, [funnels]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funnels</h1>
          <p className="text-sm text-muted-foreground">
            Funnels linked to campaigns with editable funnel steps.
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
                  <TableHead className="text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funnels.map((f) => (
                  <TableRow
                    key={f.id}
                    role="button"
                    onClick={() => {
                      setActiveFunnel(f);
                      setStepsOpen(true);
                    }}
                  >
                    <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-1">
                        <Input
                          className="h-8 max-w-[260px]"
                          value={funnelNameById[f.id] ?? f.name}
                          onChange={(e) =>
                            setFunnelNameById((m) => ({ ...m, [f.id]: e.target.value }))
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="text-xs text-muted-foreground">Click row to edit steps</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.campaign_name ?? "—"}</TableCell>
                    <TableCell>{f.step_count}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={patchMutation.isPending}
                          onClick={() => {
                            const nm = (funnelNameById[f.id] ?? f.name).trim();
                            if (nm.length < 2) {
                              toast.error("Name must be at least 2 characters.");
                              return;
                            }
                            patchMutation.mutate({ funnelId: f.id, name: nm, status: f.status });
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteFunnelMutation.isPending}
                          onClick={() => {
                            if (!window.confirm("Delete this funnel and its steps?")) return;
                            deleteFunnelMutation.mutate(f.id);
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
        open={stepsOpen}
        onOpenChange={(v) => {
          setStepsOpen(v);
          if (!v) setActiveFunnel(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Funnel steps {activeFunnel ? `· ${activeFunnel.name}` : ""}</DialogTitle>
          </DialogHeader>

          {!activeFunnel ? (
            <p className="text-sm text-muted-foreground">No funnel selected.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_140px]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={newStep.name}
                    onChange={(e) => setNewStep((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Landing page"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select
                    value={newStep.step_type}
                    onValueChange={(v) => setNewStep((s) => ({ ...s, step_type: StepType.parse(v) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(StepType.options as string[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Slug</label>
                  <Input
                    value={newStep.slug}
                    onChange={(e) => setNewStep((s) => ({ ...s, slug: e.target.value }))}
                    placeholder="landing"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={() => createStep.mutate()}
                    disabled={createStep.isPending || newStep.name.trim().length < 1 || newStep.slug.trim().length < 1}
                  >
                    {createStep.isPending ? "Creating…" : "Add step"}
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  {stepsQuery.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : stepsQuery.isError ? (
                    <p className="text-sm text-destructive">Failed to load steps.</p>
                  ) : steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No steps yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Slug</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {steps.map((s, idx) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">{s.step_index}</TableCell>
                            <TableCell className="font-medium">
                              <Input
                                id={`funnel-step-name-${s.id}`}
                                className="h-8"
                                defaultValue={s.name}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== s.name) patchStep.mutate({ stepId: s.id, name: v });
                                  else e.target.value = s.name;
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={s.step_type}
                                onValueChange={(v) => patchStep.mutate({ stepId: s.id, step_type: StepType.parse(v) })}
                              >
                                <SelectTrigger className="h-8 w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(StepType.options as string[]).map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              <Input
                                id={`funnel-step-slug-${s.id}`}
                                className="h-8"
                                defaultValue={s.slug}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== s.slug) patchStep.mutate({ stepId: s.id, slug: v });
                                  else e.target.value = s.slug;
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={patchStep.isPending}
                                onClick={() => {
                                  const nmEl = document.getElementById(`funnel-step-name-${s.id}`) as HTMLInputElement | null;
                                  const slEl = document.getElementById(`funnel-step-slug-${s.id}`) as HTMLInputElement | null;
                                  const nm = (nmEl?.value ?? "").trim();
                                  const sl = (slEl?.value ?? "").trim();
                                  if (nm.length < 1 || sl.length < 1) {
                                    toast.error("Name and slug are required.");
                                    return;
                                  }
                                  patchStep.mutate({
                                    stepId: s.id,
                                    name: nm,
                                    slug: sl,
                                    step_type: s.step_type,
                                  });
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={idx === 0 || reorderSteps.isPending}
                                onClick={() => {
                                  const order = steps.map((x) => x.id);
                                  const tmp = order[idx - 1];
                                  order[idx - 1] = order[idx];
                                  order[idx] = tmp;
                                  reorderSteps.mutate(order);
                                }}
                              >
                                Up
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={idx === steps.length - 1 || reorderSteps.isPending}
                                onClick={() => {
                                  const order = steps.map((x) => x.id);
                                  const tmp = order[idx + 1];
                                  order[idx + 1] = order[idx];
                                  order[idx] = tmp;
                                  reorderSteps.mutate(order);
                                }}
                              >
                                Down
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={deleteStep.isPending}
                                onClick={() => deleteStep.mutate({ stepId: s.id })}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {steps.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2">
                      {steps.map((s) => (
                        <li key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                          <div className="flex items-center gap-3">
                            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{s.step_index}</span>
                            <div>
                              <div className="text-sm font-medium">{s.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {s.step_type} · /{s.slug}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
