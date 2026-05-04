"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain } from "lucide-react";

import type { AiWorkspaceThinkingLine } from "@/components/ai/useAiWorkspaceStream";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AiWorkspaceThinkingPanel(props: {
  lines: AiWorkspaceThinkingLine[];
  active: boolean;
  className?: string;
}) {
  const { lines, active, className } = props;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current?.querySelector("[data-thinking-end]");
    el?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  return (
    <Card className={cn("border-border/60 bg-card/40 backdrop-blur-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Brain className={cn("h-4 w-4 text-violet-400", active && "animate-pulse")} />
          <CardTitle className="text-base">AI thinking</CardTitle>
          {active ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Live
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-[min(220px,28vh)] overflow-y-auto pr-1">
          <div ref={ref} className="space-y-2 text-sm">
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground">Reasoning and step updates from the model will stream here.</p>
            ) : (
              <AnimatePresence initial={false}>
                {lines.map((l) => (
                  <motion.div
                    key={l.id}
                    layout
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5"
                  >
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{l.step}</div>
                    <div className="text-xs leading-snug text-foreground/90">{l.message}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div data-thinking-end aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
