"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Goal = "leads" | "sales" | "traffic";

export function GrowthOnboardingClient(props: { organizationId: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [loading, setLoading] = React.useState(false);

  const [url, setUrl] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [goal, setGoal] = React.useState<Goal>("leads");

  const canNext =
    (step === 1 && url.trim().startsWith("http")) ||
    (step === 2 && audience.trim().length >= 2) ||
    step === 3;

  const onSubmit = async () => {
    setLoading(true);
    try {
      // 1) Create campaign
      const name = `${goal === "leads" ? "Lead Gen" : goal === "sales" ? "Sales" : "Traffic"} · ${new URL(url).hostname}`.slice(0, 80);
      const create = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          name,
          type: goal === "sales" ? "client" : "lead_gen",
          status: "draft",
          targetAudience: audience,
          description: `Onboarding input\\nURL: ${url}\\nGoal: ${goal}\\nAudience: ${audience}`,
        }),
      });
      const cj = (await create.json().catch(() => null)) as { ok?: boolean; campaign?: { id: string }; message?: string };
      if (!create.ok || !cj?.campaign?.id) throw new Error(cj?.message ?? "Campaign create failed");
      const campaignId = cj.campaign.id;

      // 2) Run Growth Engine (server orchestrates + persists everything)
      const run = await fetch("/api/growth/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          url,
          goal: goal === "traffic" ? "Increase qualified traffic" : goal === "sales" ? "Drive purchases / revenue" : "Generate qualified leads",
          audience,
          trafficSource: "Google Ads",
          budget: 25,
          provider: "hybrid",
          adsProviderMode: "stub",
          approvalMode: "auto_draft",
          mode: "client",
        }),
      });
      const rj = (await run.json().catch(() => null)) as { ok?: boolean; message?: string; pipeline?: { campaignId?: string | null } };
      if (!run.ok || !rj?.ok) throw new Error(rj?.message ?? "Growth run failed");

      toast.success("Campaign created. Your Growth Engine is building now.");
      router.push(`/admin/workspace/review/${campaignId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Let’s launch your first campaign</h1>
        <p className="text-sm text-muted-foreground">
          3 steps. Then AiWorkers builds the offer, funnel, ads, routing, and follow-up—ready for traffic.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Step {step} of 3{" "}
            <span className="text-muted-foreground font-normal">
              {step === 1 ? "What do you want to grow?" : step === 2 ? "Who are your customers?" : "What is the goal?"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <div className="space-y-2">
              <Label htmlFor="url">Business URL</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
              <p className="text-xs text-muted-foreground">We’ll extract the offer + positioning from the site.</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-2">
              <Label htmlFor="audience">Target audience</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Busy homeowners who need a reliable contractor"
              />
              <p className="text-xs text-muted-foreground">Be specific: role, urgency, and what they’re trying to avoid.</p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-2">
              <Label>Goal</Label>
              <Select value={goal} onValueChange={(v) => setGoal(v as Goal)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leads">Generate leads</SelectItem>
                  <SelectItem value="sales">Drive sales</SelectItem>
                  <SelectItem value="traffic">Increase traffic</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">We’ll optimize the funnel and ads around this conversion target.</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={loading || step === 1}
              onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button type="button" disabled={loading || !canNext} onClick={() => setStep((s) => (s === 1 ? 2 : 3))}>
                Next
              </Button>
            ) : (
              <Button type="button" disabled={loading} onClick={onSubmit}>
                Build + launch my campaign
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Outcome:</span> URL → AI builds funnel + ads → leads captured →
          pipeline scored → follow-up triggered → optimization loop.
        </CardContent>
      </Card>
    </div>
  );
}

