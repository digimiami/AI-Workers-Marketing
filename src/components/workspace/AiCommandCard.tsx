"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AiCommandValues = {
  url: string;
  goal: string;
  audience: string;
  trafficSource: string;
  funnelStyle?: "clickfunnels_lead" | "bridge_lead" | "application" | "webinar" | "product_offer";
};

export function AiCommandCard(props: {
  value: AiCommandValues;
  onChange: (next: AiCommandValues) => void;
  onSubmit: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const v = props.value;
  const can = Boolean(v.url.trim() && v.goal.trim() && v.audience.trim() && v.trafficSource.trim());

  return (
    <Card className={cn("glass-panel overflow-hidden border-border/60 shadow-lg", props.className)}>
      <div className="border-b border-border/50 bg-gradient-to-r from-cyan-500/10 via-transparent to-emerald-500/10 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span>Paste your URL and brief — AiWorkers builds the full stack live.</span>
        </div>
      </div>
      <CardContent className="space-y-5 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">URL</Label>
            <Input
              value={v.url}
              onChange={(e) => props.onChange({ ...v, url: e.target.value })}
              placeholder="https://example.com"
              className="h-12 rounded-xl border-border/70 bg-background/80 text-base shadow-inner"
            />
          </div>
          <Button type="button" onClick={props.onSubmit} disabled={props.disabled || !can} className="h-12 rounded-xl px-6 shadow-[0_0_24px_-8px_rgba(34,211,238,0.45)]">
            {props.disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="ml-2">Build with AI</span>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Goal</Label>
            <Textarea
              value={v.goal}
              onChange={(e) => props.onChange({ ...v, goal: e.target.value })}
              rows={2}
              placeholder="What you want this campaign to achieve"
            />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Input value={v.audience} onChange={(e) => props.onChange({ ...v, audience: e.target.value })} placeholder="Who this is for" />
          </div>
          <div className="space-y-2">
            <Label>Traffic source</Label>
            <Input
              value={v.trafficSource}
              onChange={(e) => props.onChange({ ...v, trafficSource: e.target.value })}
              placeholder="Google Ads, YouTube, organic…"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Funnel style</Label>
            <Select
              value={v.funnelStyle ?? "clickfunnels_lead"}
              onValueChange={(value) => props.onChange({ ...v, funnelStyle: value as AiCommandValues["funnelStyle"] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a funnel style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clickfunnels_lead">ClickFunnels Lead (2-step: landing → thank you)</SelectItem>
                <SelectItem value="bridge_lead">Bridge Lead (landing → bridge → thank you)</SelectItem>
                <SelectItem value="application">Application (landing → form → thank you)</SelectItem>
                <SelectItem value="webinar">Webinar (landing → register → thank you + nurture)</SelectItem>
                <SelectItem value="product_offer">Product Offer (landing → checkout → thank you)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
