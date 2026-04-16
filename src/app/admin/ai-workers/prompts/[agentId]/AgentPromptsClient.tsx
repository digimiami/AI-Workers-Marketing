"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  system_prompt: string;
  style_rules: string | null;
  forbidden_claims: string | null;
  output_format: string | null;
  campaign_context: string | null;
  is_default: boolean;
  version: number;
};

export function AgentPromptsClient({
  organizationId,
  agentId,
}: {
  organizationId: string;
  agentId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState({
    name: "Custom",
    system_prompt: "",
    style_rules: "",
    forbidden_claims: "",
    output_format: "",
    campaign_context: "",
    is_default: false,
  });

  const q = useQuery({
    queryKey: ["openclaw-templates", organizationId, agentId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/openclaw/templates?organizationId=${organizationId}&agentId=${agentId}`,
      );
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; templates: Template[] };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/openclaw/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          agentId,
          name: form.name,
          system_prompt: form.system_prompt,
          style_rules: form.style_rules || null,
          forbidden_claims: form.forbidden_claims || null,
          output_format: form.output_format || null,
          campaign_context: form.campaign_context || null,
          is_default: form.is_default,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Template saved");
      await qc.invalidateQueries({ queryKey: ["openclaw-templates", organizationId, agentId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (seededRef.current) return;
    const def = q.data?.templates?.find((t) => t.is_default) ?? q.data?.templates?.[0];
    if (!def) return;
    seededRef.current = true;
    setForm({
      name: def.name,
      system_prompt: def.system_prompt,
      style_rules: def.style_rules ?? "",
      forbidden_claims: def.forbidden_claims ?? "",
      output_format: def.output_format ?? "",
      campaign_context: def.campaign_context ?? "",
      is_default: def.is_default,
    });
  }, [q.data?.templates]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prompt templates</h1>
        <p className="text-sm text-muted-foreground">
          Stored in `agent_templates` (DB). Default template syncs from the code registry on first
          sync.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sys">System prompt</Label>
            <Textarea
              id="sys"
              rows={10}
              value={form.system_prompt}
              onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="style">Style rules</Label>
              <Textarea
                id="style"
                rows={4}
                value={form.style_rules}
                onChange={(e) => setForm((f) => ({ ...f, style_rules: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forbid">Forbidden claims</Label>
              <Textarea
                id="forbid"
                rows={4}
                value={form.forbidden_claims}
                onChange={(e) => setForm((f) => ({ ...f, forbidden_claims: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fmt">Output format</Label>
            <Input
              id="fmt"
              value={form.output_format}
              onChange={(e) => setForm((f) => ({ ...f, output_format: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctx">Campaign context override</Label>
            <Textarea
              id="ctx"
              rows={3}
              value={form.campaign_context}
              onChange={(e) => setForm((f) => ({ ...f, campaign_context: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
            />
            Set as default template for this agent
          </label>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save template"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
