"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { LiveWorkspaceBuildInput } from "@/hooks/useLiveWorkspaceBuild";
import { Button, buttonVariants } from "@/components/ui/button";
import { pipelineRunInputToLiveBuild } from "@/services/workspace/pipelineRunInput";
import { cn } from "@/lib/utils";

export type SavedWorkspaceRunRow = {
  id: string;
  campaignId: string | null;
  campaignName: string | null;
  status: string;
  currentStage: string | null;
  preview: { url: string; goal: string };
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

type Props = {
  variant?: "full" | "compact";
  /** When set (compact), hide this run and cap list length. */
  currentRunId?: string | null;
  disabled?: boolean;
  onRegenerate: (input: LiveWorkspaceBuildInput) => void;
};

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function WorkspaceSavedRunsList(props: Props) {
  const { variant = "full", currentRunId, disabled, onRegenerate } = props;
  const router = useRouter();
  const [runs, setRuns] = React.useState<SavedWorkspaceRunRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/marketing-pipeline/runs", { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; runs?: SavedWorkspaceRunRow[]; message?: string };
      if (!res.ok || !j?.ok || !Array.isArray(j.runs)) {
        throw new Error(j?.message ?? "Failed to load workspaces");
      }
      setRuns(j.runs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load workspaces");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const visible = React.useMemo(() => {
    let list = runs;
    if (variant === "compact" && currentRunId) {
      list = list.filter((r) => r.id !== currentRunId);
    }
    if (variant === "compact") return list.slice(0, 8);
    return list;
  }, [runs, variant, currentRunId]);

  const onDelete = (id: string) => {
    if (!window.confirm("Delete this saved workspace run? This cannot be undone.")) return;
    void (async () => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/admin/marketing-pipeline/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; message?: string };
        if (!res.ok || !j?.ok) throw new Error(j?.message ?? "Delete failed");
        toast.success("Workspace removed");
        setRuns((prev) => prev.filter((r) => r.id !== id));
        if (currentRunId === id) router.replace("/admin/workspace");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    })();
  };

  const onRegenerateClick = async (run: SavedWorkspaceRunRow) => {
    const res = await fetch(`/api/admin/marketing-pipeline/runs/${encodeURIComponent(run.id)}`);
    const j = (await res.json().catch(() => null)) as { ok?: boolean; run?: { input?: unknown }; message?: string };
    if (!res.ok || !j?.ok || !j.run) {
      toast.error(j?.message ?? "Could not load run inputs");
      return;
    }
    const live = pipelineRunInputToLiveBuild(j.run.input);
    if (!live) {
      toast.error("This run has no reusable URL/goal inputs — start a new build from the form.");
      return;
    }
    toast.message("Starting a fresh build from saved inputs…");
    onRegenerate(live);
  };

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground",
          variant === "compact" && "p-3",
        )}
      >
        Loading saved workspaces…
      </div>
    );
  }

  if (visible.length === 0 && variant === "compact") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/50 shadow-sm",
        variant === "compact" ? "p-3" : "p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold tracking-tight">Saved workspaces</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every live build is stored here. Open to review, run again from the same inputs, or delete from storage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={disabled || loading}>
            Refresh
          </Button>
          {variant === "compact" ? (
            <Link href="/admin/workspace" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              All workspaces
            </Link>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No saved runs yet — submit the form above to create one.</p>
      ) : (
        <ul className={cn("mt-4 divide-y divide-border/60", variant === "compact" && "mt-3")}>
          {visible.map((run) => (
            <li key={run.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {truncate(run.preview.url.replace(/^https?:\/\//, ""), 56) || "—"}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{formatWhen(run.createdAt)}</span>
                  <span className="text-border">·</span>
                  <span className="capitalize">{run.status}</span>
                  {run.currentStage ? (
                    <>
                      <span className="text-border">·</span>
                      <span>{run.currentStage}</span>
                    </>
                  ) : null}
                  {run.campaignName ? (
                    <>
                      <span className="text-border">·</span>
                      <span className="truncate">{run.campaignName}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-wrap gap-2">
                <Link
                  href={`/admin/workspace/${run.id}`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), disabled && "pointer-events-none opacity-50")}
                  aria-disabled={disabled}
                >
                  Open
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled}
                  onClick={() => void onRegenerateClick(run)}
                >
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                  disabled={disabled || deletingId === run.id}
                  onClick={() => onDelete(run.id)}
                >
                  {deletingId === run.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
