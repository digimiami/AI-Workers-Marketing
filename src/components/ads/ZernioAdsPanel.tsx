"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, ExternalLink, KeyRound, Loader2, Plug, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ZernioAdsPanel(props: { organizationId: string; campaignId?: string | null }) {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = React.useState("");
  const [command, setCommand] = React.useState("");
  const [allowSpend, setAllowSpend] = React.useState(false);
  const [lastReply, setLastReply] = React.useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["zernio-ads-status", props.organizationId],
    queryFn: async () => {
      const res = await fetch("/api/admin/ads/zernio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, action: "status" }),
      });
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        status?: { connected?: boolean; orgConnected?: boolean; envFallback?: boolean; serverUrl?: string };
        adsToolCount?: number;
        toolCount?: number;
      };
      if (!res.ok) return { connected: false, message: j?.message ?? "Not connected", ...j };
      return j;
    },
  });

  const connected = Boolean(statusQuery.data?.status?.connected ?? statusQuery.data?.ok);

  const connect = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/integrations/zernio-mcp/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, apiKey: apiKey.trim() }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; message?: string };
      if (!res.ok || !j?.ok) throw new Error(j?.message ?? "Connect failed");
    },
    onSuccess: async () => {
      toast.success("Zernio API key saved — AI can manage ads on your connected platforms");
      setApiKey("");
      await qc.invalidateQueries({ queryKey: ["zernio-ads-status", props.organizationId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Connect failed"),
  });

  const test = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/integrations/zernio-mcp/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; toolCount?: number };
      if (!res.ok || !j?.ok) throw new Error(j?.message ?? "Test failed");
      return j;
    },
    onSuccess: (j) => toast.success(j.message ?? `Connected (${j.toolCount ?? 0} tools)`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Test failed"),
  });

  const runCommand = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ads/zernio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          action: "command",
          message: command.trim(),
          campaignId: props.campaignId ?? undefined,
          allowSpend,
        }),
      });
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        reply?: string;
        message?: string;
        blocked?: boolean;
      };
      if (!res.ok && !j?.reply) throw new Error(j?.message ?? "Command failed");
      return j;
    },
    onSuccess: (j) => {
      setLastReply(j.reply ?? j.message ?? "Done");
      if (j.blocked) toast.warning("Enable “Allow spend/create” to run write actions");
      else if (j.ok) toast.success("Zernio ads command completed");
      else toast.error(j.reply ?? "Command failed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Command failed"),
  });

  const listCampaigns = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/ads/zernio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: props.organizationId, action: "list_campaigns" }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; data?: unknown; message?: string };
      if (!res.ok) throw new Error(j?.message ?? "List failed");
      return j;
    },
    onSuccess: (j) => {
      const text = typeof j.data === "string" ? j.data : JSON.stringify(j.data, null, 2);
      setLastReply(text.slice(0, 4000));
      toast.success("Loaded campaigns from Zernio");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "List failed"),
  });

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-transparent to-indigo-500/5">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4 text-cyan-400" />
              Zernio MCP — Ads platforms
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Connect with your{" "}
              <a
                href="https://zernio.com/dashboard/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Zernio API key
              </a>{" "}
              so the AI assistant can list, create, and manage Meta / Google / TikTok ads via 280+ MCP tools.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                Connected
                {statusQuery.data?.status?.orgConnected ? " (org key)" : statusQuery.data?.status?.envFallback ? " (server env)" : ""}
              </span>
            ) : (
              <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-100">
                Not connected
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="zernio-api-key" className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              Zernio API key
            </Label>
            <Input
              id="zernio-api-key"
              type="password"
              autoComplete="off"
              placeholder="sk_… from zernio.com/dashboard/api-keys"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Stored encrypted per organization. Also connect ad accounts at{" "}
              <a href="https://zernio.com" target="_blank" rel="noopener noreferrer" className="underline">
                zernio.com
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={connect.isPending || apiKey.trim().length < 10} onClick={() => connect.mutate()}>
              {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save API key"}
            </Button>
            <Button type="button" variant="outline" disabled={!connected || test.isPending} onClick={() => test.mutate()}>
              {test.isPending ? "Testing…" : "Test MCP"}
            </Button>
            <Link href="/admin/settings#zernio-mcp" className={buttonVariants({ variant: "secondary" })}>
              Settings
              <ExternalLink className="ml-2 h-3.5 w-3.5 inline" />
            </Link>
          </div>
        </div>

        {connected ? (
          <>
            <div className="rounded-xl border border-border/50 bg-muted/10 p-3 text-xs text-muted-foreground">
              MCP endpoint:{" "}
              <code className="font-mono">{statusQuery.data?.status?.serverUrl ?? "https://mcp.zernio.com/mcp"}</code>
              {" · "}
              Ads tools: {statusQuery.data?.adsToolCount ?? "—"} / {statusQuery.data?.toolCount ?? "—"} total
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
                AI Ads Assistant
              </Label>
              <Textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                rows={3}
                placeholder='e.g. "List my Meta ad campaigns", "Create a $50/day leads campaign to my landing page", "Show ad analytics for last 7 days"'
                className="min-h-[88px] resize-y bg-background/60 text-sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={allowSpend}
                    onChange={(e) => setAllowSpend(e.target.checked)}
                    className="rounded border-border"
                  />
                  Allow spend / create (launch & boost ads)
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={runCommand.isPending || !command.trim()}
                  onClick={() => runCommand.mutate()}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {runCommand.isPending ? "Running…" : "Run command"}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={listCampaigns.isPending} onClick={() => listCampaigns.mutate()}>
                  List campaigns
                </Button>
              </div>
            </div>

            {lastReply ? (
              <pre
                className={cn(
                  "max-h-64 overflow-auto rounded-xl border border-border/50 bg-background/80 p-3 text-[11px] leading-relaxed whitespace-pre-wrap",
                )}
              >
                {lastReply}
              </pre>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
