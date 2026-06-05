"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Loader2, MessageSquarePlus, Send, Sparkles, User } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  workerKey?: string | null;
  suggestions?: string[];
  workspaceUrl?: string | null;
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — paste your website URL and I'll scan it, find your audience, and build your funnel, landing page, and ad campaign. No site yet? Send keywords + target area + goal.",
  suggestions: [
    "Generate leads for mysite.com",
    "Scan my website and build a Google Ads campaign",
    "Keywords: roofing, Miami — book consultations",
  ],
};

const STARTER_PROMPTS = [
  "Create a marketing campaign for my roofing business",
  "Build a landing page for lead capture",
  "Launch Facebook ads with a $500 budget",
  "Write a 5-email nurture sequence",
  "How are my campaigns performing?",
];

function sessionStorageKey(organizationId: string) {
  return `mission_control.session.${organizationId}`;
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 mr-auto max-w-[88%]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-muted-foreground/50"
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-start gap-2", isUser ? "ml-auto flex-row-reverse max-w-[88%]" : "mr-auto max-w-[88%]")}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
          isUser ? "rounded-tr-md bg-primary text-primary-foreground" : "rounded-tl-md bg-muted/70 text-foreground",
        )}
      >
        {message.content}
        {!isUser && message.workspaceUrl ? (
          <Link
            href={message.workspaceUrl}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-3 w-full")}
          >
            Open Workspace — watch build live
          </Link>
        ) : null}
        {!isUser && message.workerKey ? (
          <p className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            Routed via {message.workerKey.replace(/_/g, " ")}
          </p>
        ) : null}
      </div>
    </motion.div>
  );
}

export function MissionControlChatbot({ organizationId }: { organizationId: string }) {
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([WELCOME]);
  const [draft, setDraft] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [quickReplies, setQuickReplies] = React.useState<string[]>(WELCOME.suggestions ?? []);
  const [lastWorkspaceUrl, setLastWorkspaceUrl] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(sessionStorageKey(organizationId));
      if (saved) setSessionId(saved);
    } catch {
      // ignore
    }
  }, [organizationId]);

  React.useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      try {
        const res = await fetch(
          `/api/mission-control/sessions/${sessionId}/messages?organizationId=${organizationId}`,
        );
        const json = await res.json();
        if (!json.ok || !Array.isArray(json.messages) || json.messages.length === 0) return;
        const loaded: ChatMessage[] = json.messages.map(
          (m: { id: string; role: string; content: string; workerKey?: string; suggestions?: string[] }) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
            workerKey: m.workerKey,
            suggestions: m.suggestions,
          }),
        );
        setMessages(loaded);
        const lastAssistant = [...loaded].reverse().find((m) => m.role === "assistant");
        if (lastAssistant?.suggestions?.length) setQuickReplies(lastAssistant.suggestions);
      } catch {
        // keep welcome state
      }
    })();
  }, [sessionId, organizationId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const persistSession = (id: string) => {
    setSessionId(id);
    try {
      localStorage.setItem(sessionStorageKey(organizationId), id);
    } catch {
      // ignore
    }
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([WELCOME]);
    setQuickReplies(WELCOME.suggestions ?? []);
    setDraft("");
    try {
      localStorage.removeItem(sessionStorageKey(organizationId));
    } catch {
      // ignore
    }
    inputRef.current?.focus();
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    if (trimmed === "Open Workspace" && lastWorkspaceUrl) {
      window.location.href = lastWorkspaceUrl;
      return;
    }

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setTyping(true);
    setQuickReplies([]);

    try {
      const res = await fetch("/api/mission-control/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          sessionId: sessionId ?? undefined,
          message: trimmed,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Message failed");

      persistSession(json.sessionId);
      const workspaceUrl =
        typeof json.workspaceUrl === "string" ? json.workspaceUrl : null;
      if (workspaceUrl) setLastWorkspaceUrl(workspaceUrl);
      const assistantMsg: ChatMessage = {
        id: `local-asst-${Date.now()}`,
        role: "assistant",
        content: json.reply ?? "I'm on it — tell me a bit more about your business.",
        workerKey: json.routed?.primaryWorker,
        suggestions: json.suggestions ?? [],
        workspaceUrl,
      };
      setMessages((m) => [...m, assistantMsg]);
      if (assistantMsg.suggestions?.length) setQuickReplies(assistantMsg.suggestions);
      if (json.launched && workspaceUrl) {
        window.setTimeout(() => {
          window.location.href = workspaceUrl;
        }, 1200);
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `local-err-${Date.now()}`,
          role: "assistant",
          content:
            e instanceof Error
              ? e.message
              : "Sorry — I couldn't reach the server. Try again in a moment.",
        },
      ]);
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-[min(72vh,640px)] rounded-xl border border-border/60 glass-panel overflow-hidden bg-background/80">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3 bg-accent/15">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">AI Assistant</p>
            <p className="text-xs text-muted-foreground truncate">
              {typing ? "Typing…" : "Online · coordinates your workers"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button type="button" size="sm" variant="ghost" onClick={startNewChat} title="New chat">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Link href="/admin/workspace" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Workspace
          </Link>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </AnimatePresence>
        {typing ? <TypingIndicator /> : null}
      </div>

      <div className="border-t border-border/50 bg-background/90 p-3 space-y-2">
        {quickReplies.length > 0 && !typing ? (
          <div className="flex flex-wrap gap-1.5">
            {quickReplies.map((q) => (
              <button
                key={q}
                type="button"
                className="text-xs rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
                onClick={() => void send(q)}
              >
                {q}
              </button>
            ))}
          </div>
        ) : messages.length <= 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.map((ex) => (
              <button
                key={ex}
                type="button"
                className="text-xs rounded-full border border-border/60 px-2.5 py-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                onClick={() => void send(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message your AI assistant…"
            rows={1}
            className={cn(
              "flex-1 min-h-[44px] max-h-32 resize-none rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm",
              "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl" disabled={!draft.trim() || typing}>
            {typing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground/80">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
