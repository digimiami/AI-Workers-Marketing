"use client";

import * as React from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LicenseRow = {
  id: string;
  agent_catalog_slug: string;
  status: string;
  source: string;
  provisioned_agent_id: string | null;
  provisioned_at: string | null;
  agent_catalog: {
    title: string;
    short_title: string;
    tagline: string;
    openclaw_agent_key: string;
  } | null;
};

const AGENTS_SITE = "https://agents.aiworkers.vip";

export function MyAgentsClient({ organizationId }: { organizationId: string }) {
  const searchParams = useSearchParams();
  const checkoutAgent = searchParams.get("agent");
  const billing = searchParams.get("billing");

  const [licenses, setLicenses] = React.useState<LicenseRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busySlug, setBusySlug] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/agents-marketplace/my-agents?organizationId=${organizationId}`,
      );
      const j = (await res.json()) as { ok: boolean; licenses: LicenseRow[] };
      if (!res.ok || !j.ok) throw new Error("Failed to load agents");
      setLicenses(j.licenses ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (billing === "success") {
      toast.success("Payment received — your AI worker is being activated.");
      void load();
    }
    if (billing === "cancel") toast.message("Checkout canceled");
  }, [billing, load]);

  React.useEffect(() => {
    if (!checkoutAgent || billing) return;
    void startCheckout(checkoutAgent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutAgent]);

  async function startCheckout(agentSlug: string) {
    setBusySlug(agentSlug);
    try {
      const res = await fetch("/api/agents-marketplace/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, agentSlug }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        checkoutUrl?: string;
        message?: string;
        code?: string;
      };
      if (j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
        return;
      }
      if (j.code === "MISSING_STRIPE_PRICE") {
        toast.message(j.message ?? "Contact sales to activate this agent");
        return;
      }
      throw new Error(j.message ?? "Checkout failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusySlug(null);
    }
  }

  async function startTrial(agentSlug: string) {
    setBusySlug(agentSlug);
    try {
      const res = await fetch("/api/agents-marketplace/provision-trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, agentSlug }),
      });
      const j = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !j.ok) throw new Error(j.message ?? "Trial activation failed");
      toast.success("AI worker activated on your account");
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trial failed");
    } finally {
      setBusySlug(null);
    }
  }

  const active = licenses.filter((l) => l.status === "active" && l.provisioned_agent_id);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">My AI Workers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Workers you own are provisioned here and ready in Mission Control.
          </p>
        </div>
        <a
          href={AGENTS_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline" })}
        >
          <ShoppingBag className="size-4" aria-hidden />
          Hire more workers
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </p>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No active AI workers yet.</p>
            <a href={AGENTS_SITE} className={buttonVariants({ className: "mt-4" })}>
              Browse agents
            </a>
            {checkoutAgent ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  disabled={busySlug === checkoutAgent}
                  onClick={() => void startCheckout(checkoutAgent)}
                >
                  Complete purchase
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busySlug === checkoutAgent}
                  onClick={() => void startTrial(checkoutAgent)}
                >
                  Start 14-day trial (dev)
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((lic) => (
            <Card key={lic.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle2 className="size-5 text-primary" aria-hidden />
                  {lic.agent_catalog?.title ?? lic.agent_catalog_slug}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {lic.agent_catalog?.tagline}
                </p>
                <p className="text-xs text-muted-foreground">
                  Runtime: {lic.agent_catalog?.openclaw_agent_key} · Source: {lic.source}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/ai-workers/prompts/${lic.provisioned_agent_id}`}
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    Customize prompts
                  </Link>
                  <Link
                    href="/admin/mission-control"
                    className={buttonVariants({ size: "sm" })}
                  >
                    Open Mission Control
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {licenses.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All licenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {licenses.map((lic) => (
              <div
                key={lic.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                  lic.status === "active" ? "border-primary/30" : "border-border/50",
                )}
              >
                <span>{lic.agent_catalog?.short_title ?? lic.agent_catalog_slug}</span>
                <span className="text-xs text-muted-foreground capitalize">{lic.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
