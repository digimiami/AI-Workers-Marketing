import { PublicShell } from "@/components/marketing/PublicShell";
import { PageHero } from "@/components/marketing/page-hero";
import { PageCloseCta } from "@/components/marketing/page-close-cta";
import { Reveal } from "@/components/marketing/motion-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles } from "lucide-react";

export default function DemoPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Interactive"
        title="Shape a funnel recommendation in minutes."
        description="Enter your business context and goals. You’ll see how workers collaborate—full structured output can be gated behind email capture when you wire the API."
        motif={
          <div className="flex size-24 items-center justify-center rounded-3xl border border-primary/30 bg-primary/10 text-primary shadow-lg md:size-28">
            <Sparkles className="size-11 md:size-12" aria-hidden />
          </div>
        }
      />

      <div className="mkt-page grid gap-8 pb-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <Reveal>
          <Card className="border-border/70 bg-card/70 shadow-md backdrop-blur-md dark:border-white/[0.08] dark:bg-card/50">
            <CardHeader>
              <CardTitle className="font-display text-xl">Demo inputs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Structured fields map cleanly to Opportunity Scout + Funnel Architect prompts.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Business type</label>
                  <Input placeholder="e.g. SaaS, realtor, med spa" className="bg-background/80" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target offer</label>
                  <Input placeholder="What are you promoting?" className="bg-background/80" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audience</label>
                  <Input placeholder="Who is it for?" className="bg-background/80" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Traffic goal</label>
                  <Textarea placeholder="e.g. 30 leads/week from short-form + retargeting" className="bg-background/80" />
                </div>
                <Button type="button" className="w-full font-semibold shadow-md shadow-primary/20">
                  Generate recommendation
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Next: connect to OpenClaw “Opportunity Discovery” flow and gate full output behind your lead capture API.
                </p>
              </form>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.06}>
          <Card className="border-border/70 bg-gradient-to-b from-card/90 to-muted/20 shadow-md backdrop-blur-md dark:border-white/[0.08] dark:from-card/60">
            <CardHeader>
              <CardTitle className="font-display text-xl">Live preview</CardTitle>
              <p className="text-sm text-muted-foreground">Mirrors the structured outputs your operators approve.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {["Funnel type", "Content angles", "Recommended workers", "Email gate status"].map((label) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/50 bg-background/50 p-4 font-mono text-xs backdrop-blur-sm dark:border-white/[0.06]"
                >
                  <span className="text-muted-foreground">{label}:</span>{" "}
                  <span className="text-foreground">—</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <PageCloseCta title="Prefer we run the first audit for you?" />
    </PublicShell>
  );
}
