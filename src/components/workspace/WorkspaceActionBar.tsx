"use client";

import { ExternalLink, Pencil, RefreshCw, ShieldCheck, Eye } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceAction = "open" | "edit" | "regenerate" | "approve" | "preview";

export function WorkspaceActionBar(props: {
  className?: string;
  /** Shown when payload is live_preview / draft */
  showDraftBadge?: boolean;
  openHref?: string;
  editHref?: string;
  previewHref?: string;
  onRegenerate?: () => void;
  onApprove?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 pt-2", props.className)}>
      {props.showDraftBadge ? (
        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
          Generated draft
        </span>
      ) : null}
      {props.openHref ? (
        <a href={props.openHref} className={buttonVariants({ variant: "outline", size: "sm", className: "inline-flex h-8 items-center border-border/70" })}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Open
        </a>
      ) : null}
      {props.editHref ? (
        <a href={props.editHref} className={buttonVariants({ variant: "outline", size: "sm", className: "inline-flex h-8 items-center border-border/70" })}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </a>
      ) : null}
      {props.previewHref ? (
        <a
          href={props.previewHref}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "secondary", size: "sm", className: "inline-flex h-8 items-center" })}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          Preview
        </a>
      ) : null}
      {props.onRegenerate ? (
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-sky-300" disabled={props.disabled} onClick={props.onRegenerate}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Regenerate
        </Button>
      ) : null}
      {props.onApprove ? (
        <Button variant="ghost" size="sm" className="h-8 text-emerald-300 hover:text-emerald-200" disabled={props.disabled} onClick={props.onApprove}>
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Approve
        </Button>
      ) : null}
    </div>
  );
}
