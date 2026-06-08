"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { launchFirstCampaignAction } from "@/app/admin/onboarding/growth/actions";

type Goal = "leads" | "sales" | "traffic";

export function GrowthOnboardingClient(props: { organizationId: string; canLaunch: boolean }) {
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
    if (!props.canLaunch) {
      toast.error("You need admin or operator access in this workspace to launch a campaign.");
      return;
    }
    setLoading(true);
    try {
      const result = await launchFirstCampaignAction({ url, audience, goal });
      if (!result.ok) throw new Error(result.message);

      toast.success("Campaign created. Your Growth Engine is building now.");
      router.push(`/admin/workspace/review/${result.campaignId}`);
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

      {!props.canLaunch ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Permission required.</span> Your current workspace role cannot
            create campaigns. Open the sidebar → Organization → switch to a workspace where you are{" "}
            <span className="text-foreground">admin</span> or <span className="text-foreground">operator</span>, then try
            again.
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Outcome:</span> URL → AI builds funnel + ads → leads captured →
          pipeline scored → follow-up triggered → optimization loop.
        </CardContent>
      </Card>
    </div>
  );
}

