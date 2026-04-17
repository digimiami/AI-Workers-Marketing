"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
