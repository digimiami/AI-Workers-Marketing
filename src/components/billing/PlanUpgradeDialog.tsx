"use client";

import * as React from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PlanKey = "free" | "starter" | "pro" | "agency";

export type PlanUpgradeReason = "campaign_limit" | "ads_launch" | "ai_usage" | "generic";

const REASON_COPY: Record<PlanUpgradeReason, { title: string; body: string }> = {
  campaign_limit: {
    title: "Upgrade to launch more campaigns",
    body: "You've reached the campaign limit on your current plan. Upgrade to keep building, or open the campaign you already have.",
  },
  ads_launch: {
    title: "Upgrade to launch paid ads",
    body: "Paid ad launch is locked on your current plan. Upgrade to unlock Meta/Google launch, approvals, and the optimization loop.",
  },
  ai_usage: {
    title: "Upgrade to keep generating",
    body: "You've hit the monthly AI generation limit for your plan. Upgrade for higher limits and faster builds.",
  },
  generic: {
    title: "Upgrade required",
    body: "This action isn't available on your current plan. Upgrade to continue.",
  },
};

const TIERS: Array<{ key: Exclude<PlanKey, "free">; name: string; price: string; note: string; highlight?: boolean }> = [
  { key: "starter", name: "Starter", price: "$29/mo", note: "3 campaigns · core AI" },
  { key: "pro", name: "Pro", price: "$97/mo", note: "Unlimited · ads launch · optimization", highlight: true },
  { key: "agency", name: "Agency", price: "$297/mo", note: "Unlimited · white-label ready" },
];

export function PlanUpgradeDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  reason: PlanUpgradeReason;
  currentPlan: PlanKey;
  /** Optional secondary action (e.g. "Open existing campaign"). */
  secondaryAction?: { label: string; onClick: () => void };
}) {
  const [busy, setBusy] = React.useState<PlanKey | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const copy = REASON_COPY[props.reason];

  const startCheckout = React.useCallback(
    async (plan: Exclude<PlanKey, "free">) => {
      setBusy(plan);
      setError(null);
      try {
        const res = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: props.organizationId, plan }),
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; checkoutUrl?: string; message?: string };
        if (!res.ok || !j?.checkoutUrl) throw new Error(j?.message ?? "Failed to start checkout");
        window.location.href = j.checkoutUrl;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed");
      } finally {
        setBusy(null);
      }
    },
    [props.organizationId],
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle className="text-base">{copy.title}</DialogTitle>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>{copy.body}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {TIERS.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={busy !== null}
                {...(busy === p.key ? { "aria-busy": "true" as const } : {})}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-colors",
                  p.highlight
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border/60 bg-muted/10 hover:bg-muted/20",
                  busy !== null ? "opacity-70" : "",
                )}
                onClick={() => void startCheckout(p.key)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.price}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{p.note}</div>
                {busy === p.key ? <div className="mt-1 text-[11px] text-muted-foreground">Opening checkout…</div> : null}
              </button>
            ))}
          </div>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span>
              Current plan: <span className="font-mono text-foreground">{props.currentPlan}</span>
            </span>
            {props.secondaryAction ? (
              <button
                type="button"
                onClick={props.secondaryAction.onClick}
                className="rounded-md border border-border/60 px-2 py-1 text-foreground/80 hover:bg-muted/20"
              >
                {props.secondaryAction.label}
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Parse a server error string like `INTERNAL_ERROR: create_campaign: PLAN_LIMIT_CAMPAIGNS:free`. */
export function parsePlanLimitMessage(message: string): { reason: PlanUpgradeReason; plan: PlanKey } | null {
  const norm = message ?? "";
  const map: Array<[RegExp, PlanUpgradeReason]> = [
    [/PLAN_LIMIT_CAMPAIGNS:(free|starter|pro|agency)/i, "campaign_limit"],
    [/PLAN_BLOCK_AD_LAUNCH:(free|starter|pro|agency)/i, "ads_launch"],
    [/PLAN_LIMIT_AI(?:_USAGE)?:(free|starter|pro|agency)/i, "ai_usage"],
  ];
  for (const [re, reason] of map) {
    const m = norm.match(re);
    if (m) {
      const plan = (m[1]?.toLowerCase() ?? "free") as PlanKey;
      return { reason, plan };
    }
  }
  return null;
}
