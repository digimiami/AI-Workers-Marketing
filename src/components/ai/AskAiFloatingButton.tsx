"use client";

import * as React from "react";

import { Bot } from "lucide-react";

import { AskAiPanel } from "@/components/ai/AskAiPanel";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AskAiFloatingButton(props: {
  /** `sheet` opens the AskAiPanel; `button` renders a simple floating button. */
  variant?: "sheet" | "button";
  title?: string;
  subtitle?: string;
  suggestions?: Array<{ label: string; prompt: string }>;
  onSubmit?: (prompt: string) => Promise<void> | void;
  onClick?: () => void;
  label?: string;
  className?: string;
}) {
  const variant = props.variant ?? "sheet";

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className={cn(
          "fixed bottom-6 right-6 z-40 rounded-full bg-cyan-500 px-4 py-3 text-sm font-semibold text-black shadow-lg hover:bg-cyan-400",
          props.className,
        )}
      >
        {props.label ?? "🤖 Ask AI"}
      </button>
    );
  }

  return (
    <div className={cn("fixed bottom-5 right-5 z-40", props.className)}>
      <Sheet>
        <SheetTrigger
          render={<Button className="rounded-full shadow-lg" />}
          aria-label="Ask AiWorkers"
          title="Ask AiWorkers"
        >
          <Bot className="h-4 w-4 mr-2" />
          Ask AiWorkers
        </SheetTrigger>
        <SheetContent side="right" className="w-[420px] max-w-[92vw]">
          <SheetHeader className="mb-4">
            <SheetTitle>Ask AiWorkers</SheetTitle>
          </SheetHeader>
          <AskAiPanel
            title={props.title ?? "Ask AiWorkers"}
            subtitle={props.subtitle}
            suggestions={props.suggestions}
            onSubmit={props.onSubmit}
            className="border-0 bg-transparent shadow-none"
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AskAiFloatingButton;

