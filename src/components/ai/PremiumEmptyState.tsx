"use client";

import * as React from "react";

import { ArrowRight, Bot, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PremiumEmptyState(props: {
  title: string;
  description: string;
  primaryAction?: { label: string; onClick?: () => void; href?: string };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  hint?: string;
  className?: string;
}) {
  const A = (a: { label: string; onClick?: () => void; href?: string }, variant: "default" | "secondary") => {
    if (a.href) {
      return (
        <a
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium shadow transition-colors",
            variant === "default"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-accent/40 text-foreground hover:bg-accent/60 border border-border/60",
          )}
          href={a.href}
        >
          {a.label}
          <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
        </a>
      );
    }
    return (
      <Button variant={variant} onClick={a.onClick}>
        {a.label}
        <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
      </Button>
    );
  };

  return (
    <Card className={cn("glass-panel border-border/60", props.className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary/90" />
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">{props.description}</div>
        <div className="flex flex-wrap gap-2">
          {props.primaryAction ? A(props.primaryAction, "default") : null}
          {props.secondaryAction ? A(props.secondaryAction, "secondary") : null}
        </div>
        {props.hint ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
            <Bot className="h-4 w-4 opacity-80" />
            <span className="min-w-0 truncate">{props.hint}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

