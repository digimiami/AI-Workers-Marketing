"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type EmailLogStatus = "queued" | "sent" | "failed";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body_markdown: string;
  created_at: string;
  updated_at: string;
};

type EmailSequence = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EmailSequenceStep = {
  id: string;
  sequence_id: string;
  step_index: number;
  delay_minutes: number;
  template_id: string | null;
  template_name: string | null;
  created_at: string;
  updated_at: string;
};

type EmailLogRow = {
  id: string;
  to_email: string;
  subject: string;
  status: EmailLogStatus;
  provider: string;
  error_message: string | null;
  created_at: string;
};

const createTemplateBody = z.object({
  name: z.string().min(2),
  subject: z.string().min(1),
  body_markdown: z.string().min(1),
});

const createSequenceBody = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

export function EmailClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState("templates");
  const [tplDialog, setTplDialog] = React.useState<EmailTemplate | null>(null);
  const [tplDraft, setTplDraft] = React.useState({ name: "", subject: "", body_markdown: "" });
  const [seqDialog, setSeqDialog] = React.useState<EmailSequence | null>(null);
  const [seqDraft, setSeqDraft] = React.useState({ name: "", description: "" });
  const [delayDraft, setDelayDraft] = React.useState<Record<string, string>>({});

  // Templates
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [templateForm, setTemplateForm] = React.useState({
    name: "",
    subject: "",
    body_markdown: "",
  });

  const templatesQuery = useQuery({
    queryKey: ["email-templates", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/templates?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; templates: EmailTemplate[] };
      return j.templates ?? [];
    },
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      const parsed = createTemplateBody.parse(templateForm);
      const res = await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, ...parsed }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Template created");
      setTemplateOpen(false);
      setTemplateForm({ name: "", subject: "", body_markdown: "" });
      await qc.invalidateQueries({ queryKey: ["email-templates", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create template"),
  });

  // Sequences
  const [sequenceOpen, setSequenceOpen] = React.useState(false);
  const [sequenceForm, setSequenceForm] = React.useState({ name: "", description: "" });
  const [selectedSequenceId, setSelectedSequenceId] = React.useState<string>("");

  const sequencesQuery = useQuery({
    queryKey: ["email-sequences", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/sequences?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; sequences: EmailSequence[] };
      return j.sequences ?? [];
    },
  });

  const createSequence = useMutation({
    mutationFn: async () => {
      const parsed = createSequenceBody.parse(sequenceForm);
      const res = await fetch("/api/admin/email/sequences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: parsed.name,
          description: parsed.description?.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Sequence created");
      setSequenceOpen(false);
      setSequenceForm({ name: "", description: "" });
      await qc.invalidateQueries({ queryKey: ["email-sequences", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create sequence"),
  });

  const toggleSequence = useMutation({
    mutationFn: async (vars: { sequenceId: string; is_active: boolean }) => {
      const res = await fetch(`/api/admin/email/sequences/${vars.sequenceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, is_active: vars.is_active }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["email-sequences", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  // Steps for selected sequence
  const [stepTemplateId, setStepTemplateId] = React.useState<string>("");
  const [stepDelay, setStepDelay] = React.useState<string>("0");

  const stepsQuery = useQuery({
    queryKey: ["email-sequence-steps", organizationId, selectedSequenceId],
    enabled: Boolean(selectedSequenceId),
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/email/sequences/${selectedSequenceId}/steps?organizationId=${organizationId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; steps: EmailSequenceStep[] };
      return j.steps ?? [];
    },
  });

  const addStep = useMutation({
    mutationFn: async () => {
      if (!selectedSequenceId) throw new Error("Select a sequence first");
      const delayMinutes = Number.parseInt(stepDelay, 10);
      if (Number.isNaN(delayMinutes) || delayMinutes < 0) throw new Error("Delay must be >= 0");
      const res = await fetch(`/api/admin/email/sequences/${selectedSequenceId}/steps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          delay_minutes: delayMinutes,
          template_id: stepTemplateId || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Step added");
      setStepDelay("0");
      setStepTemplateId("");
      await qc.invalidateQueries({
        queryKey: ["email-sequence-steps", organizationId, selectedSequenceId],
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to add step"),
  });

  const patchStep = useMutation({
    mutationFn: async (vars: { stepId: string; delay_minutes?: number; template_id?: string | null }) => {
      if (!selectedSequenceId) throw new Error("Select a sequence first");
      const res = await fetch(`/api/admin/email/steps/${vars.stepId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, ...vars }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Step updated");
      await qc.invalidateQueries({
        queryKey: ["email-sequence-steps", organizationId, selectedSequenceId],
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteStep = useMutation({
    mutationFn: async (vars: { stepId: string }) => {
      const res = await fetch(`/api/admin/email/steps/${vars.stepId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Step deleted");
      await qc.invalidateQueries({
        queryKey: ["email-sequence-steps", organizationId, selectedSequenceId],
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const patchTemplateRemote = useMutation({
    mutationFn: async (vars: { id: string; name: string; subject: string; body_markdown: string }) => {
      const res = await fetch(`/api/admin/email/templates/${vars.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: vars.name,
          subject: vars.subject,
          body_markdown: vars.body_markdown,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Template saved");
      setTplDialog(null);
      await qc.invalidateQueries({ queryKey: ["email-templates", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteTemplateRemote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email/templates/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Template deleted");
      setTplDialog(null);
      await qc.invalidateQueries({ queryKey: ["email-templates", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const patchSequenceRemote = useMutation({
    mutationFn: async (vars: { id: string; name: string; description: string | null }) => {
      const res = await fetch(`/api/admin/email/sequences/${vars.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: vars.name,
          description: vars.description,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Sequence saved");
      setSeqDialog(null);
      await qc.invalidateQueries({ queryKey: ["email-sequences", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteSequenceRemote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/email/sequences/${id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async (_, deletedId) => {
      toast.success("Sequence deleted");
      setSeqDialog(null);
      setSelectedSequenceId((cur) => (cur === deletedId ? "" : cur));
      await qc.invalidateQueries({ queryKey: ["email-sequences", organizationId] });
      await qc.invalidateQueries({ queryKey: ["email-sequence-steps", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  // Logs
  const logsQuery = useQuery({
    queryKey: ["email-logs", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/email/logs?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; logs: EmailLogRow[] };
      return j.logs ?? [];
    },
  });

  const templates = templatesQuery.data ?? [];
  const sequences = sequencesQuery.data ?? [];
  const steps = stepsQuery.data ?? [];
  const logs = logsQuery.data ?? [];

  const defaultSequenceId = React.useMemo(() => sequences[0]?.id ?? "", [sequences]);

  React.useEffect(() => {
    if (!selectedSequenceId && defaultSequenceId) setSelectedSequenceId(defaultSequenceId);
  }, [selectedSequenceId, defaultSequenceId]);

  React.useEffect(() => {
    if (!tplDialog) return;
    setTplDraft({
      name: tplDialog.name,
      subject: tplDialog.subject,
      body_markdown: tplDialog.body_markdown,
    });
  }, [tplDialog]);

  React.useEffect(() => {
    if (!seqDialog) return;
    setSeqDraft({ name: seqDialog.name, description: seqDialog.description ?? "" });
  }, [seqDialog]);

  React.useEffect(() => {
    setDelayDraft((prev) => {
      const next = { ...prev };
      for (const st of steps) {
        if (next[st.id] === undefined) next[st.id] = String(st.delay_minutes);
      }
      return next;
    });
  }, [steps]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email sequences</h1>
        <p className="text-sm text-muted-foreground">
          Templates, sequences, steps, and delivery logs (Resend-ready).
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="sequences">Sequences</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="pt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Create reusable templates for steps in sequences.
            </div>
            <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
              <DialogTrigger render={<Button>New template</Button>} />
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>New email template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Welcome — Day 0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={templateForm.subject}
                      onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Quick question about {{company}}"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Body (markdown)</label>
                    <Textarea
                      rows={10}
                      value={templateForm.body_markdown}
                      onChange={(e) =>
                        setTemplateForm((f) => ({ ...f, body_markdown: e.target.value }))
                      }
                      placeholder={"Hi {{first_name}},\n\n..."}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createTemplate.mutate()}
                    disabled={createTemplate.isPending}
                  >
                    {createTemplate.isPending ? "Creating…" : "Create template"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {templatesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : templatesQuery.isError ? (
                <p className="text-sm text-destructive">Failed to load templates.</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="text-right w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-muted-foreground">{t.subject}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(t.updated_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setTplDialog(t)}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteTemplateRemote.isPending}
                              onClick={() => {
                                if (!window.confirm(`Delete template “${t.name}”?`)) return;
                                deleteTemplateRemote.mutate(t.id);
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

          <Dialog open={Boolean(tplDialog)} onOpenChange={(o) => !o && setTplDialog(null)}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Edit template</DialogTitle>
              </DialogHeader>
              {tplDialog ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={tplDraft.name}
                      onChange={(e) => setTplDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={tplDraft.subject}
                      onChange={(e) => setTplDraft((d) => ({ ...d, subject: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Body (markdown)</label>
                    <Textarea
                      rows={10}
                      value={tplDraft.body_markdown}
                      onChange={(e) => setTplDraft((d) => ({ ...d, body_markdown: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={patchTemplateRemote.isPending}
                      onClick={() => {
                        const parsed = createTemplateBody.safeParse({
                          name: tplDraft.name,
                          subject: tplDraft.subject,
                          body_markdown: tplDraft.body_markdown,
                        });
                        if (!parsed.success) {
                          toast.error("Name (2+ chars), subject, and body are required.");
                          return;
                        }
                        patchTemplateRemote.mutate({
                          id: tplDialog.id,
                          name: parsed.data.name,
                          subject: parsed.data.subject,
                          body_markdown: parsed.data.body_markdown,
                        });
                      }}
                    >
                      {patchTemplateRemote.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setTplDialog(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="sequences" className="pt-4 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Sequences define the step schedule; steps choose templates.
            </div>
            <Dialog open={sequenceOpen} onOpenChange={setSequenceOpen}>
              <DialogTrigger render={<Button>New sequence</Button>} />
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New sequence</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={sequenceForm.name}
                      onChange={(e) => setSequenceForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Cold outreach — SaaS founders"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description (optional)</label>
                    <Textarea
                      rows={4}
                      value={sequenceForm.description}
                      onChange={(e) =>
                        setSequenceForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="Who it’s for, what offer, what CTA."
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createSequence.mutate()}
                    disabled={createSequence.isPending}
                  >
                    {createSequence.isPending ? "Creating…" : "Create sequence"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sequences</CardTitle>
            </CardHeader>
            <CardContent>
              {sequencesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : sequencesQuery.isError ? (
                <p className="text-sm text-destructive">Failed to load sequences.</p>
              ) : sequences.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sequences yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="text-right w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sequences.map((s) => (
                      <TableRow
                        key={s.id}
                        className={selectedSequenceId === s.id ? "bg-accent/40" : undefined}
                        onClick={() => setSelectedSequenceId(s.id)}
                        role="button"
                      >
                        <TableCell className="font-medium">
                          <div className="space-y-0.5">
                            <div>{s.name}</div>
                            {s.description ? (
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {s.description}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={s.is_active}
                              onCheckedChange={(checked) =>
                                toggleSequence.mutate({ sequenceId: s.id, is_active: Boolean(checked) })
                              }
                            />
                            <span className="text-xs text-muted-foreground">
                              {s.is_active ? "On" : "Off"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {new Date(s.updated_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setSeqDialog(s)}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={deleteSequenceRemote.isPending}
                              onClick={() => {
                                if (!window.confirm(`Delete sequence “${s.name}” and its steps?`)) return;
                                deleteSequenceRemote.mutate(s.id);
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

          <Dialog open={Boolean(seqDialog)} onOpenChange={(o) => !o && setSeqDialog(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit sequence</DialogTitle>
              </DialogHeader>
              {seqDialog ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      value={seqDraft.name}
                      onChange={(e) => setSeqDraft((d) => ({ ...d, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      rows={4}
                      value={seqDraft.description}
                      onChange={(e) => setSeqDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={patchSequenceRemote.isPending}
                      onClick={() => {
                        const parsed = createSequenceBody.safeParse({
                          name: seqDraft.name,
                          description: seqDraft.description || undefined,
                        });
                        if (!parsed.success) {
                          toast.error("Name must be at least 2 characters.");
                          return;
                        }
                        patchSequenceRemote.mutate({
                          id: seqDialog.id,
                          name: parsed.data.name.trim(),
                          description: parsed.data.description?.trim() || null,
                        });
                      }}
                    >
                      {patchSequenceRemote.isPending ? "Saving…" : "Save changes"}
                    </Button>
                    <Button variant="outline" onClick={() => setSeqDialog(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_160px_140px]">
                <div className="space-y-2">
                  <span className="text-sm font-medium">Template</span>
                  <Select
                    value={stepTemplateId || "__none__"}
                    onValueChange={(v) => setStepTemplateId(typeof v === "string" && v !== "__none__" ? v : "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No template yet</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-medium">Delay (minutes)</span>
                  <Input value={stepDelay} onChange={(e) => setStepDelay(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={() => addStep.mutate()}
                    disabled={addStep.isPending || !selectedSequenceId}
                  >
                    {addStep.isPending ? "Adding…" : "Add step"}
                  </Button>
                </div>
              </div>

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
                      <TableHead>Delay</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {steps.map((st) => (
                      <TableRow key={st.id}>
                        <TableCell className="font-mono text-xs">{st.step_index}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <Input
                            className="h-8 w-[120px]"
                            value={delayDraft[st.id] ?? String(st.delay_minutes)}
                            onChange={(e) =>
                              setDelayDraft((m) => ({ ...m, [st.id]: e.target.value }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={st.template_id ?? "__none__"}
                            onValueChange={(v) =>
                              patchStep.mutate({
                                stepId: st.id,
                                template_id: typeof v === "string" && v !== "__none__" ? v : null,
                              })
                            }
                          >
                            <SelectTrigger className="w-[260px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No template yet</SelectItem>
                              {templates.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={patchStep.isPending}
                              onClick={() => {
                                const raw = delayDraft[st.id] ?? String(st.delay_minutes);
                                const n = Number.parseInt(raw, 10);
                                if (!Number.isFinite(n) || n < 0) {
                                  toast.error("Delay must be >= 0");
                                  return;
                                }
                                patchStep.mutate({
                                  stepId: st.id,
                                  delay_minutes: n,
                                  template_id: st.template_id,
                                });
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteStep.mutate({ stepId: st.id })}
                              disabled={deleteStep.isPending}
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
        </TabsContent>

        <TabsContent value="logs" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Delivery logs</CardTitle>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : logsQuery.isError ? (
                <p className="text-sm text-destructive">Failed to load logs.</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No email logs yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{l.to_email}</TableCell>
                        <TableCell className="text-muted-foreground">{l.subject}</TableCell>
                        <TableCell className="text-sm">{l.status}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.provider}
                          {l.status === "failed" && l.error_message ? (
                            <div className="text-xs text-destructive mt-1 line-clamp-2">
                              {l.error_message}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

