"use client";

import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function isRenderable(v: unknown): v is React.ReactNode {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || React.isValidElement(v);
}

export function WorkspaceCard(props: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  /** Convenience prop for simple “title + content” usage */
  content?: unknown;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {props.icon ? <span className="text-primary">{props.icon}</span> : null}
              <CardTitle className="text-base">{props.title}</CardTitle>
            </div>
            {props.description ? <CardDescription>{props.description}</CardDescription> : null}
          </div>
          {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
        </div>
      </CardHeader>
      {props.children ? (
        <CardContent className="text-sm">{props.children}</CardContent>
      ) : props.content !== undefined ? (
        <CardContent className="text-sm">
          {isRenderable(props.content) ? (
            <div className="text-muted-foreground">{String(props.content)}</div>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              {JSON.stringify(props.content, null, 2)}
            </pre>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

export default WorkspaceCard;

