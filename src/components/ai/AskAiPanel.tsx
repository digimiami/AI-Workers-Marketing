"use client";

import * as React from "react";

import { Bot, CornerDownLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Suggestion = { label: string; prompt: string };

export function AskAiPanel(props: {
  title?: string;
  subtitle?: string;
  suggestions?: Suggestion[];
  context?: Record<string, unknown>;
  onSubmit?: (prompt: string) => Promise<void> | void;
  className?: string;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const suggestions: Suggestion[] =
    props.suggestions ??
    [
      { label: "Tell me what to do next", prompt: "Tell me what to do next to launch this campaign." },
      { label: "Generate funnel", prompt: "Generate a landing + bridge + lead capture step funnel." },
      { label: "Create ad creatives", prompt: "Create 10 ad creatives for this campaign across the selected traffic source." },
      { label: "Write email sequence", prompt: "Write a 5-email nurture sequence for new leads." },
      { label: "Analyze performance", prompt: "Analyze performance and propose 5 next tests." },
    ];

  const submit = async (prompt: string) => {
    if (!prompt.trim()) return;
    if (!props.onSubmit) {
      toast.message("AI panel is UI-ready", { description: "Hook this to your preferred run endpoint for in-page actions." });
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit(prompt.trim());
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={cn("glass-panel border-border/60", props.className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-primary/90" />
          {props.title ?? "Ask AI"}
        </CardTitle>
        {props.subtitle ? <div className="text-xs text-muted-foreground">{props.subtitle}</div> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask AI… (e.g. “Generate 20 hooks for TikTok ads”)"
            className="pr-10"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit(text);
              }
            }}
          />
          <Button
            size="icon-sm"
            variant="secondary"
            className="absolute right-1 top-1 h-7 w-7"
            onClick={() => void submit(text)}
            disabled={busy}
            title="Send"
          >
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Button
              key={s.label}
              size="sm"
              variant="secondary"
              className="border border-border/50 bg-background/40 hover:bg-accent/40"
              onClick={() => void submit(s.prompt)}
              disabled={busy}
            >
              <Sparkles className="h-4 w-4 mr-2 opacity-80" />
              {s.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

