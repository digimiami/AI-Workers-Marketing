"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Recommendation = {
  funnelType: string;
  contentAngles: string[];
  recommendedWorkers: string[];
  nextStep: string;
};

export function DemoForm() {
  const [businessType, setBusinessType] = React.useState("");
  const [offer, setOffer] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [trafficGoal, setTrafficGoal] = React.useState("");
  const [recommendation, setRecommendation] = React.useState<Recommendation | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/public/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessType, offer, audience, trafficGoal }),
      });
      const json = (await res.json()) as { recommendation?: Recommendation; message?: string };
      if (!res.ok || !json.recommendation) throw new Error(json.message ?? "Could not generate recommendation");
      setRecommendation(json.recommendation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 pb-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="demo-business">
            Business type
          </label>
          <Input id="demo-business" value={businessType} onChange={(e) => setBusinessType(e.target.value)} placeholder="e.g. SaaS, realtor, med spa" className="bg-background/80" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="demo-offer">
            Target offer
          </label>
          <Input id="demo-offer" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="What are you promoting?" className="bg-background/80" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="demo-audience">
            Audience
          </label>
          <Input id="demo-audience" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who is it for?" className="bg-background/80" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="demo-goal">
            Traffic goal
          </label>
          <Textarea id="demo-goal" value={trafficGoal} onChange={(e) => setTrafficGoal(e.target.value)} placeholder="e.g. 30 leads/week from short-form + retargeting" className="bg-background/80" required />
        </div>
        <Button type="submit" disabled={loading} className="w-full font-semibold shadow-md shadow-primary/20">
          {loading ? "Generating..." : "Generate recommendation"}
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </form>

      <div className="space-y-3 text-sm text-muted-foreground">
        <PreviewRow label="Funnel type" value={recommendation?.funnelType ?? "-"} />
        <PreviewRow label="Content angles" value={recommendation ? recommendation.contentAngles.join(" | ") : "-"} />
        <PreviewRow label="Recommended workers" value={recommendation ? recommendation.recommendedWorkers.join(", ") : "-"} />
        <PreviewRow label="Next step" value={recommendation?.nextStep ?? "-"} />
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-4 font-mono text-xs backdrop-blur-sm dark:border-white/[0.06]">
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="text-foreground">{value}</span>
    </div>
  );
}
