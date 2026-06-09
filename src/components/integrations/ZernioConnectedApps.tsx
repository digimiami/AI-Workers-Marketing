"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

export type ZernioConnectedAccountRow = {
  id: string;
  platform: string;
  label: string;
  status?: string;
  username?: string | null;
};

export function ZernioConnectedApps(props: {
  accounts: ZernioConnectedAccountRow[];
  accountsError?: string | null;
  loading?: boolean;
  className?: string;
}) {
  if (props.loading) {
    return <p className={cn("text-xs text-muted-foreground", props.className)}>Loading connected apps…</p>;
  }

  if (props.accountsError) {
    return (
      <p className={cn("text-xs rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100", props.className)}>
        {props.accountsError}. Connect platforms at{" "}
        <a href="https://zernio.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">
          zernio.com/dashboard
        </a>
        .
      </p>
    );
  }

  if (!props.accounts.length) {
    return (
      <div className={cn("rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground", props.className)}>
        No apps connected on Zernio yet.{" "}
        <a
          href="https://zernio.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
        >
          Connect Instagram, Meta Ads, Google Ads…
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", props.className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Connected on Zernio ({props.accounts.length})
        </p>
        <Link
          href="https://zernio.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-primary underline underline-offset-2 inline-flex items-center gap-1"
        >
          Manage on Zernio
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {props.accounts.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{a.label}</div>
              {a.username ? (
                <div className="text-xs text-muted-foreground truncate">@{a.username.replace(/^@/, "")}</div>
              ) : (
                <div className="text-xs text-muted-foreground truncate">{a.platform}</div>
              )}
            </div>
            {a.status ? (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                  a.status.toLowerCase() === "connected"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-800 dark:text-amber-200",
                )}
              >
                {a.status}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
