"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, Loader2, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function ZernioConnectCard(props: { organizationId: string; className?: string; compact?: boolean }) {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = React.useState("");

  const statusQuery = useQuery({
    queryKey: ["zernio-ads-status", props.organizationId],
    queryFn: async () => {
      const url = new URL("/api/admin/integrations/zernio-mcp/connect", window.location.origin);
      url.searchParams.set("organizationId", props.organizationId);
      const res = await fetch(url.toString());
      const j = (await res.json().catch(() => null)) as {
        ok?: boolean;
        connected?: boolean;
        orgConnected?: boolean;
        serverUrl?: string;
      };
      if (!res.ok) return { connected: false, ...j };
      return j;
    },
  });

  const connected = Boolean(statusQuery.data?.connected);

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
      toast.success("Zernio connected — AI can manage your ad platforms");
      setApiKey("");
      await qc.invalidateQueries({ queryKey: ["zernio-ads-status", props.organizationId] });
      await statusQuery.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Connect failed"),
  });

  if (connected && props.compact) {
    return (
      <Card className={cn("border-emerald-500/20 bg-emerald-500/5", props.className)}>
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Zernio connected</span>
          </div>
          <Link href="/admin/ads" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Ads Manager
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (connected) {
    return (
      <Card className={cn("border-emerald-500/20 bg-emerald-500/5", props.className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4 text-emerald-400" />
            Zernio connected
          </CardTitle>
          <CardDescription>
            Your API key is saved. Use Mission Control chat or{" "}
            <Link href="/admin/ads" className="text-primary underline underline-offset-2">
              Ads Manager
            </Link>{" "}
            to manage Meta, Google, and TikTok ads.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={cn("border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-transparent to-indigo-500/5", props.className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4 text-cyan-400" />
          Connect Zernio
        </CardTitle>
        <CardDescription className="text-xs">
          Paste your{" "}
          <a
            href="https://zernio.com/dashboard/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Zernio API key
          </a>{" "}
          to let the AI manage ads on Meta, Google, and TikTok. Any workspace member can connect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="zernio-connect-key" className="flex items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            API key
          </Label>
          <Input
            id="zernio-connect-key"
            type="password"
            autoComplete="off"
            placeholder="sk_… from zernio.com/dashboard/api-keys"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <Button type="button" size="sm" disabled={connect.isPending || apiKey.trim().length < 10} onClick={() => connect.mutate()}>
          {connect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save API key"}
        </Button>
      </CardContent>
    </Card>
  );
}
