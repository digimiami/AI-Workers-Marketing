"use client";

import { FormInput } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LeadCaptureCardData = {
  forms?: Array<{ id?: string; name?: string; status?: string }>;
};

export function LeadCaptureCard(props: { data?: unknown; className?: string }) {
  const d = (props.data && typeof props.data === "object" ? props.data : {}) as LeadCaptureCardData;
  const forms = Array.isArray(d.forms) ? d.forms : [];
  if (!forms.length) return null;
  return (
    <Card className={cn("border-border/60 bg-card/50 backdrop-blur-sm", props.className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FormInput className="h-4 w-4 text-slate-300" />
          <CardTitle className="text-base">Lead capture</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-0 text-sm">
        {forms.map((f) => (
          <div key={f.id} className="flex justify-between gap-2 rounded-lg border border-border/50 bg-muted/15 px-2 py-1 text-xs">
            <span className="font-medium">{f.name || "Form"}</span>
            <span className="text-muted-foreground">{f.status}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
