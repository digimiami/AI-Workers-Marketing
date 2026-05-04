"use client";

import * as React from "react";

import { Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type AiCommandBarInput = {
  url: string;
  goal?: string;
  audience?: string;
  trafficSource?: string;
};

export function AiCommandBar(props: {
  /** Layout */
  variant?: "url" | "plan";
  /** Optional controlled URL */
  url?: string;
  onUrlChange?: (next: string) => void;
  goal?: string;
  onGoalChange?: (next: string) => void;
  audience?: string;
  onAudienceChange?: (next: string) => void;
  trafficSource?: string;
  onTrafficSourceChange?: (next: string) => void;
  /** Called with `{ url, goal, audience, trafficSource }` (depending on variant) */
  onGenerate: (input: AiCommandBarInput) => void | Promise<void>;
  canGenerate?: boolean;
  busy?: boolean;
  buttonLabel?: string;
  className?: string;
}) {
  const [internalUrl, setInternalUrl] = React.useState("");
  const [internalGoal, setInternalGoal] = React.useState("");
  const [internalAudience, setInternalAudience] = React.useState("");
  const [internalTraffic, setInternalTraffic] = React.useState("");

  const variant = props.variant ?? "url";
  const url = typeof props.url === "string" ? props.url : internalUrl;
  const goal = typeof props.goal === "string" ? props.goal : internalGoal;
  const audience = typeof props.audience === "string" ? props.audience : internalAudience;
  const trafficSource = typeof props.trafficSource === "string" ? props.trafficSource : internalTraffic;

  const fallbackCanGenerate =
    variant === "plan"
      ? Boolean(url.trim() && goal.trim() && audience.trim() && trafficSource.trim())
      : Boolean(url.trim());
  const canGenerate = typeof props.canGenerate === "boolean" ? props.canGenerate : fallbackCanGenerate;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm space-y-4",
        props.className,
      )}
    >
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL</Label>
          <Input
            value={url}
            onChange={(e) => {
              const next = e.target.value;
              setInternalUrl(next);
              props.onUrlChange?.(next);
            }}
            placeholder="Paste URL…"
            className="h-12 rounded-xl border-border/70 bg-background/80 text-base shadow-inner"
          />
        </div>
        <Button
          type="button"
          onClick={() =>
            void props.onGenerate(
              variant === "plan" ? { url, goal, audience, trafficSource } : { url },
            )
          }
          disabled={props.busy || !canGenerate}
          className="h-12 rounded-xl px-5"
        >
          <Rocket className="h-4 w-4" />
          <span className="ml-2">{props.buttonLabel ?? (variant === "plan" ? "Generate plan" : "Generate with AI")}</span>
        </Button>
      </div>

      {variant === "plan" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Goal</Label>
            <Input
              value={goal}
              onChange={(e) => {
                const next = e.target.value;
                setInternalGoal(next);
                props.onGoalChange?.(next);
              }}
              placeholder="Get leads + affiliate clicks"
              className="bg-background/80"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Audience</Label>
            <Input
              value={audience}
              onChange={(e) => {
                const next = e.target.value;
                setInternalAudience(next);
                props.onAudienceChange?.(next);
              }}
              placeholder="Small business owners"
              className="bg-background/80"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Traffic</Label>
            <Input
              value={trafficSource}
              onChange={(e) => {
                const next = e.target.value;
                setInternalTraffic(next);
                props.onTrafficSourceChange?.(next);
              }}
              placeholder="TikTok + Shorts"
              className="bg-background/80"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default AiCommandBar;

