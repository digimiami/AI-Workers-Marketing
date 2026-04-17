"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export type LeadRow = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  status: string;
  score: number;
  campaign_id: string | null;
  campaigns?: { name: string } | null;
  source_page: string | null;
  created_at: string;
};

const statusPresets = ["new", "contacted", "qualified", "converted", "lost"] as const;

export function LeadsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [scoreDraft, setScoreDraft] = React.useState<Record<string, string>>({});

  const leadsQuery = useQuery({
    queryKey: ["leads", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/leads?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; leads: LeadRow[] };
      return j.leads ?? [];
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (vars: { leadId: string; status?: string; score?: number }) => {
      const res = await fetch(`/api/admin/leads/${vars.leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          status: vars.status,
          score: vars.score,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: async () => {
      toast.success("Lead updated");
      await qc.invalidateQueries({ queryKey: ["leads", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const leads = leadsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Org-scoped leads (unique email per organization). Update pipeline status and score.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {leadsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : leadsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load leads.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.email}</TableCell>
                    <TableCell>{l.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.campaigns?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={l.status}
                        onValueChange={(v) => {
                          if (typeof v !== "string") return;
                          patchMutation.mutate({ leadId: l.id, status: v });
                        }}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([...statusPresets, l.status])].map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 w-16"
                          value={scoreDraft[l.id] ?? String(l.score)}
                          onChange={(e) => setScoreDraft((d) => ({ ...d, [l.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            const raw = scoreDraft[l.id] ?? String(l.score);
                            const n = Number.parseInt(raw, 10);
                            if (Number.isNaN(n) || n < 0 || n > 100) {
                              toast.error("Score must be 0–100");
                              return;
                            }
                            patchMutation.mutate({ leadId: l.id, score: n });
                          }}
                        >
                          Set
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString()}
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
