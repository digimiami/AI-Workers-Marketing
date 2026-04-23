"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  type FeatureFlagKey,
  type FeatureFlags,
  getDefaultFeatureFlags,
} from "@/lib/featureFlags";
import { toast } from "sonner";

type SettingRow = { key: string; value: Record<string, unknown>; updated_at: string };

function readFeatureFlags(rows: SettingRow[]): FeatureFlags {
  const row = rows.find((r) => r.key === "feature_flags");
  const fromDb = (row?.value?.flags as Partial<FeatureFlags> | undefined) ?? {};
  return { ...getDefaultFeatureFlags(), ...fromDb };
}

export function SettingsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["settings", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/settings?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { ok: boolean; settings: SettingRow[] };
      return json.settings ?? [];
    },
  });

  const serverMerged = React.useMemo(
    () => readFeatureFlags(settingsQuery.data ?? []),
    [settingsQuery.data],
  );

  const saveFlags = useMutation({
    mutationFn: async (next: FeatureFlags) => {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          key: "feature_flags",
          value: { flags: next },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Settings saved");
      await qc.invalidateQueries({ queryKey: ["settings", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const [draft, setDraft] = React.useState<FeatureFlags | null>(null);
  const [tokenName, setTokenName] = React.useState("OpenClaw");
  const tokensQuery = useQuery({
    queryKey: ["cloud-api-tokens", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cloud-api-tokens?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as {
        ok: boolean;
        tokens: Array<{
          id: string;
          name: string;
          token_prefix: string;
          created_at: string;
          revoked_at: string | null;
          last_used_at: string | null;
        }>;
      };
    },
  });

  const createToken = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/cloud-api-tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId,
          name: tokenName.trim() || "Cloud API",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; plain_token: string; token_prefix: string };
    },
    onSuccess: async (j) => {
      await navigator.clipboard.writeText(j.plain_token);
      toast.success("Token created and copied to clipboard. Store it safely — it is not shown again.");
      await qc.invalidateQueries({ queryKey: ["cloud-api-tokens", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create token failed"),
  });

  const revokeToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const res = await fetch(
        `/api/admin/cloud-api-tokens/${tokenId}?organizationId=${encodeURIComponent(organizationId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Token revoked");
      await qc.invalidateQueries({ queryKey: ["cloud-api-tokens", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Revoke failed"),
  });

  React.useEffect(() => {
    if (settingsQuery.data) setDraft(readFeatureFlags(settingsQuery.data));
  }, [settingsQuery.data]);

  if (settingsQuery.isLoading || !draft) {
    return <p className="text-sm text-muted-foreground">Loading settings…</p>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(serverMerged);

  const toggle = (k: FeatureFlagKey, v: boolean) => {
    setDraft((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cloud API (OpenClaw & agents)</CardTitle>
          <CardDescription>
            Create org-scoped bearer tokens for{" "}
            <code className="font-mono text-xs">POST /api/v1/cloud/tools/run</code>. Public reference:{" "}
            <Link href="/docs/cloud-api" className="text-primary underline">
              API documentation
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-name">Token label</Label>
            <Input
              id="token-name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g. OpenClaw production"
            />
          </div>
          <Button type="button" onClick={() => createToken.mutate()} disabled={createToken.isPending}>
            Create token & copy to clipboard
          </Button>
          <p className="text-xs text-muted-foreground">
            The token acts as your operator for tool calls; <code className="font-mono">organization_id</code> in
            requests must match this org.
          </p>
          <div className="rounded-lg border border-border/60">
            <div className="border-b border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              Existing tokens
            </div>
            <ul className="divide-y divide-border/60">
              {(tokensQuery.data?.tokens ?? []).length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">No tokens yet.</li>
              ) : (
                (tokensQuery.data?.tokens ?? []).map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{t.name}</span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{t.token_prefix}</span>
                      {t.revoked_at ? (
                        <span className="ml-2 text-xs text-destructive">revoked</span>
                      ) : t.last_used_at ? (
                        <span className="ml-2 text-xs text-muted-foreground">last used {t.last_used_at.slice(0, 10)}</span>
                      ) : null}
                    </div>
                    {!t.revoked_at ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={revokeToken.isPending}
                        onClick={() => {
                          if (confirm("Revoke this token? OpenClaw requests using it will fail.")) {
                            revokeToken.mutate(t.id);
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feature flags</CardTitle>
          <CardDescription>
            Org-scoped toggles stored in <span className="font-mono text-xs">settings.feature_flags</span>. Changes are
            audited.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(Object.keys(draft) as FeatureFlagKey[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-4 rounded-lg border border-border/60 p-3">
              <div>
                <Label htmlFor={k} className="font-mono text-xs">
                  {k}
                </Label>
              </div>
              <Switch id={k} checked={draft[k]} onCheckedChange={(v) => toggle(k, v)} />
            </div>
          ))}
          <Button type="button" disabled={!dirty || saveFlags.isPending} onClick={() => saveFlags.mutate(draft)}>
            Save flags
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
