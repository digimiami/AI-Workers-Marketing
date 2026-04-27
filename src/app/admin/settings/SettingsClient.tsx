"use client";

import * as React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type FeatureFlagKey,
  type FeatureFlags,
  getDefaultFeatureFlags,
} from "@/lib/featureFlags";
import { toast } from "sonner";

type SettingRow = { key: string; value: Record<string, unknown>; updated_at: string };
type OrgRow = { id: string; name: string; role: string };
type PlatformRow = {
  platform:
    | "facebook"
    | "google_ads"
    | "youtube_ads"
    | "tiktok"
    | "pinterest_ads"
    | "microsoft_ads"
    | "taboola"
    | "revcontent"
    | "adcombo";
  status: { connected?: boolean; missing?: string[] };
  updated_at: string;
  credentials_redacted: Record<string, unknown>;
};

function readFeatureFlags(rows: SettingRow[]): FeatureFlags {
  const row = rows.find((r) => r.key === "feature_flags");
  const fromDb = (row?.value?.flags as Partial<FeatureFlags> | undefined) ?? {};
  return { ...getDefaultFeatureFlags(), ...fromDb };
}

export function SettingsClient({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();

  const orgsQuery = useQuery({
    queryKey: ["my-organizations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/organizations");
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; organizations: OrgRow[] };
      return j.organizations ?? [];
    },
  });

  const currentOrg = React.useMemo(
    () => (orgsQuery.data ?? []).find((o) => o.id === organizationId) ?? null,
    [orgsQuery.data, organizationId],
  );

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
  const [fbAppId, setFbAppId] = React.useState("");
  const [fbAppSecret, setFbAppSecret] = React.useState("");
  const [fbAdAccountId, setFbAdAccountId] = React.useState("");
  const [gDevToken, setGDevToken] = React.useState("");
  const [gClientId, setGClientId] = React.useState("");
  const [gClientSecret, setGClientSecret] = React.useState("");
  const [ytDevToken, setYtDevToken] = React.useState("");
  const [ytClientId, setYtClientId] = React.useState("");
  const [ytClientSecret, setYtClientSecret] = React.useState("");
  const [ttAdvertiserId, setTtAdvertiserId] = React.useState("");
  const [ttAccessToken, setTtAccessToken] = React.useState("");
  const [pinApiKey, setPinApiKey] = React.useState("");
  const [pinAccountId, setPinAccountId] = React.useState("");
  const [msDevToken, setMsDevToken] = React.useState("");
  const [msClientId, setMsClientId] = React.useState("");
  const [msClientSecret, setMsClientSecret] = React.useState("");
  const [msCustomerId, setMsCustomerId] = React.useState("");
  const [tabApiKey, setTabApiKey] = React.useState("");
  const [tabAccountId, setTabAccountId] = React.useState("");
  const [revApiKey, setRevApiKey] = React.useState("");
  const [revAccountId, setRevAccountId] = React.useState("");
  const [adcApiKey, setAdcApiKey] = React.useState("");
  const [adcAccountId, setAdcAccountId] = React.useState("");
  const [platformNotes, setPlatformNotes] = React.useState("");

  const platformQuery = useQuery({
    queryKey: ["platform-credentials", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/platform-credentials?organizationId=${organizationId}`);
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { ok: boolean; platforms: PlatformRow[] };
    },
  });

  const platformBy = React.useMemo(() => {
    const m = new Map<string, PlatformRow>();
    for (const r of platformQuery.data?.platforms ?? []) m.set(r.platform, r);
    return m;
  }, [platformQuery.data]);

  const savePlatform = useMutation({
    mutationFn: async (platform: PlatformRow["platform"]) => {
      const body =
        platform === "facebook"
          ? {
              organizationId,
              platform,
              credentials: {
                app_id: fbAppId,
                app_secret: fbAppSecret,
                ad_account_id: fbAdAccountId,
                notes: platformNotes,
              },
            }
          : platform === "google_ads"
            ? {
                organizationId,
                platform,
                credentials: {
                  developer_token: gDevToken,
                  client_id: gClientId,
                  client_secret: gClientSecret,
                  notes: platformNotes,
                },
              }
              : platform === "youtube_ads"
                ? {
                    organizationId,
                    platform,
                    credentials: {
                      developer_token: ytDevToken,
                      client_id: ytClientId,
                      client_secret: ytClientSecret,
                      notes: platformNotes,
                    },
                  }
                : platform === "tiktok"
                  ? {
                      organizationId,
                      platform,
                      credentials: {
                        advertiser_id: ttAdvertiserId,
                        access_token: ttAccessToken,
                        notes: platformNotes,
                      },
                    }
                  : platform === "pinterest_ads"
                    ? {
                        organizationId,
                        platform,
                        credentials: {
                          api_key: pinApiKey,
                          account_id: pinAccountId,
                          notes: platformNotes,
                        },
                      }
                    : platform === "microsoft_ads"
                      ? {
                          organizationId,
                          platform,
                          credentials: {
                            developer_token: msDevToken,
                            client_id: msClientId,
                            client_secret: msClientSecret,
                            customer_id: msCustomerId,
                            notes: platformNotes,
                          },
                        }
                      : platform === "taboola"
                        ? {
                            organizationId,
                            platform,
                            credentials: {
                              api_key: tabApiKey,
                              account_id: tabAccountId,
                              notes: platformNotes,
                            },
                          }
                        : platform === "revcontent"
                          ? {
                              organizationId,
                              platform,
                              credentials: {
                                api_key: revApiKey,
                                account_id: revAccountId,
                                notes: platformNotes,
                              },
                            }
                          : {
                              organizationId,
                              platform,
                              credentials: {
                                api_key: adcApiKey,
                                account_id: adcAccountId,
                                notes: platformNotes,
                              },
                            };

      const res = await fetch("/api/admin/platform-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: async () => {
      toast.success("Platform credentials saved");
      await qc.invalidateQueries({ queryKey: ["platform-credentials", organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
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

  const connectGoogleOauth = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/oauth/google/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, returnTo: "/admin/settings" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { ok: boolean; url: string };
      if (!j.url) throw new Error("Missing OAuth URL");
      window.location.href = j.url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "OAuth connect failed"),
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
          <CardTitle className="text-base">Connect OAuth</CardTitle>
          <CardDescription>
            Connect Google Analytics + Search Console via OAuth. Tokens are stored encrypted (requires{" "}
            <code className="font-mono text-xs">PLATFORM_CREDENTIALS_ENCRYPTION_KEY</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => connectGoogleOauth.mutate()}
            disabled={connectGoogleOauth.isPending}
          >
            {connectGoogleOauth.isPending ? "Opening Google…" : "Connect Google OAuth"}
          </Button>
          <p className="text-xs text-muted-foreground">
            After connecting, mark Data Sources as connected and start ingesting events.
          </p>
        </CardContent>
      </Card>

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
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs">
            <div className="text-muted-foreground">Organization for this token</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-medium">{currentOrg?.name ?? "Current org"}</span>
              {currentOrg?.role ? (
                <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {currentOrg.role}
                </span>
              ) : null}
              <span className="font-mono text-[10px] text-muted-foreground">{organizationId}</span>
            </div>
          </div>

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
          <CardTitle className="text-base">Ad Platforms</CardTitle>
          <CardDescription>
            Store ad platform credentials per organization. Values are encrypted server-side and only shown redacted.
            OAuth connections are stubbed for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea value={platformNotes} onChange={(e) => setPlatformNotes(e.target.value)} rows={2} />
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Facebook Business API</div>
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {platformBy.get("facebook")?.status?.connected ? (
                    <span className="text-emerald-600">connected</span>
                  ) : (
                    <span className="text-muted-foreground">not connected</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" disabled>
                Connect OAuth (stub)
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Facebook App ID</Label>
                <Input value={fbAppId} onChange={(e) => setFbAppId(e.target.value)} placeholder="1234567890" />
              </div>
              <div className="space-y-1">
                <Label>Facebook App Secret</Label>
                <Input value={fbAppSecret} onChange={(e) => setFbAppSecret(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Facebook Ad Account ID</Label>
                <Input value={fbAdAccountId} onChange={(e) => setFbAdAccountId(e.target.value)} placeholder="act_123…" />
              </div>
            </div>
            <Button type="button" onClick={() => savePlatform.mutate("facebook")} disabled={savePlatform.isPending}>
              Save Facebook credentials
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Google Ads API</div>
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {platformBy.get("google_ads")?.status?.connected ? (
                    <span className="text-emerald-600">connected</span>
                  ) : (
                    <span className="text-muted-foreground">not connected</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" disabled>
                Connect OAuth (stub)
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Developer Token</Label>
                <Input value={gDevToken} onChange={(e) => setGDevToken(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client ID</Label>
                <Input value={gClientId} onChange={(e) => setGClientId(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Client Secret</Label>
                <Input value={gClientSecret} onChange={(e) => setGClientSecret(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={() => savePlatform.mutate("google_ads")} disabled={savePlatform.isPending}>
              Save Google Ads credentials
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">YouTube Ads (Google)</div>
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {platformBy.get("youtube_ads")?.status?.connected ? (
                    <span className="text-emerald-600">connected</span>
                  ) : (
                    <span className="text-muted-foreground">not connected</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" disabled>
                Connect OAuth (stub)
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Developer Token</Label>
                <Input value={ytDevToken} onChange={(e) => setYtDevToken(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client ID</Label>
                <Input value={ytClientId} onChange={(e) => setYtClientId(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Client Secret</Label>
                <Input value={ytClientSecret} onChange={(e) => setYtClientSecret(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={() => savePlatform.mutate("youtube_ads")} disabled={savePlatform.isPending}>
              Save YouTube Ads credentials
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">TikTok Ads API</div>
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {platformBy.get("tiktok")?.status?.connected ? (
                    <span className="text-emerald-600">connected</span>
                  ) : (
                    <span className="text-muted-foreground">not connected</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" disabled>
                Connect OAuth (stub)
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Advertiser ID</Label>
                <Input value={ttAdvertiserId} onChange={(e) => setTtAdvertiserId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Access Token</Label>
                <Input value={ttAccessToken} onChange={(e) => setTtAccessToken(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={() => savePlatform.mutate("tiktok")} disabled={savePlatform.isPending}>
              Save TikTok credentials
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Pinterest Ads</div>
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {platformBy.get("pinterest_ads")?.status?.connected ? (
                    <span className="text-emerald-600">connected</span>
                  ) : (
                    <span className="text-muted-foreground">not connected</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" disabled>
                Connect OAuth (stub)
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>API Key</Label>
                <Input value={pinApiKey} onChange={(e) => setPinApiKey(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Account ID</Label>
                <Input value={pinAccountId} onChange={(e) => setPinAccountId(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={() => savePlatform.mutate("pinterest_ads")} disabled={savePlatform.isPending}>
              Save Pinterest credentials
            </Button>
          </div>

          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Microsoft Ads (Bing)</div>
                <div className="text-xs text-muted-foreground">
                  Status:{" "}
                  {platformBy.get("microsoft_ads")?.status?.connected ? (
                    <span className="text-emerald-600">connected</span>
                  ) : (
                    <span className="text-muted-foreground">not connected</span>
                  )}
                </div>
              </div>
              <Button type="button" variant="outline" disabled>
                Connect OAuth (stub)
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Developer Token</Label>
                <Input value={msDevToken} onChange={(e) => setMsDevToken(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Customer ID</Label>
                <Input value={msCustomerId} onChange={(e) => setMsCustomerId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client ID</Label>
                <Input value={msClientId} onChange={(e) => setMsClientId(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Client Secret</Label>
                <Input value={msClientSecret} onChange={(e) => setMsClientSecret(e.target.value)} />
              </div>
            </div>
            <Button type="button" onClick={() => savePlatform.mutate("microsoft_ads")} disabled={savePlatform.isPending}>
              Save Microsoft Ads credentials
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Taboola</div>
                  <div className="text-xs text-muted-foreground">
                    Status:{" "}
                    {platformBy.get("taboola")?.status?.connected ? (
                      <span className="text-emerald-600">connected</span>
                    ) : (
                      <span className="text-muted-foreground">not connected</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label>API Key</Label>
                  <Input value={tabApiKey} onChange={(e) => setTabApiKey(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Account ID</Label>
                  <Input value={tabAccountId} onChange={(e) => setTabAccountId(e.target.value)} />
                </div>
              </div>
              <Button type="button" onClick={() => savePlatform.mutate("taboola")} disabled={savePlatform.isPending}>
                Save Taboola credentials
              </Button>
            </div>

            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Revcontent</div>
                  <div className="text-xs text-muted-foreground">
                    Status:{" "}
                    {platformBy.get("revcontent")?.status?.connected ? (
                      <span className="text-emerald-600">connected</span>
                    ) : (
                      <span className="text-muted-foreground">not connected</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label>API Key</Label>
                  <Input value={revApiKey} onChange={(e) => setRevApiKey(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Account ID</Label>
                  <Input value={revAccountId} onChange={(e) => setRevAccountId(e.target.value)} />
                </div>
              </div>
              <Button type="button" onClick={() => savePlatform.mutate("revcontent")} disabled={savePlatform.isPending}>
                Save Revcontent credentials
              </Button>
            </div>

            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Adcombo</div>
                  <div className="text-xs text-muted-foreground">
                    Status:{" "}
                    {platformBy.get("adcombo")?.status?.connected ? (
                      <span className="text-emerald-600">connected</span>
                    ) : (
                      <span className="text-muted-foreground">not connected</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="space-y-1">
                  <Label>API Key</Label>
                  <Input value={adcApiKey} onChange={(e) => setAdcApiKey(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Account ID</Label>
                  <Input value={adcAccountId} onChange={(e) => setAdcAccountId(e.target.value)} />
                </div>
              </div>
              <Button type="button" onClick={() => savePlatform.mutate("adcombo")} disabled={savePlatform.isPending}>
                Save Adcombo credentials
              </Button>
            </div>
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
