"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LiveResultCard(props: {
  title: string;
  preview?: React.ReactNode;
  data?: unknown;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{props.title}</CardTitle>
          {props.actions ? <div className="flex flex-wrap gap-2">{props.actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {props.preview ? <div className="text-muted-foreground">{props.preview}</div> : null}
        {props.data !== undefined ? (
          <pre className="max-h-56 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
            {JSON.stringify(props.data, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default LiveResultCard;

