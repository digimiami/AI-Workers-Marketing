"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget(props: {
  organizationId: string;
  campaignId?: string | null;
  funnelId?: string | null;
  funnelStepId?: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [typing, setTyping] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState<Msg[]>([
    { role: "assistant", content: "Hi — want more leads, booked calls, or affiliate clicks?" },
  ]);

  const sessionId = React.useMemo(() => {
    const key = "aiw_chat_session_id";
    const existing = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (existing) return existing;
    const v = `sess_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    if (typeof window !== "undefined") window.localStorage.setItem(key, v);
    return v;
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setTyping(true);
    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationId: props.organizationId,
          conversationId: conversationId ?? undefined,
          campaignId: props.campaignId ?? undefined,
          funnelId: props.funnelId ?? undefined,
          funnelStepId: props.funnelStepId ?? undefined,
          sessionId,
          message: text,
        }),
      });
      const j = (await res.json()) as { ok: boolean; conversationId?: string; reply?: string };
      if (j.conversationId) setConversationId(j.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: j.reply ?? "Got it — what’s your timeline?" }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Sorry — try again in a moment." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <Card className="w-[320px] sm:w-[360px] shadow-xl border bg-background">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="text-sm font-medium">AiWorkers Chat</div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <div className="max-h-[360px] overflow-auto px-3 py-2 space-y-2">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    "inline-block rounded-lg px-3 py-2 text-sm " +
                    (m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {typing ? <div className="text-xs text-muted-foreground">Typing…</div> : null}
          </div>
          <div className="flex gap-2 p-3 border-t">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your message…"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <Button onClick={send} disabled={typing}>
              Send
            </Button>
          </div>
        </Card>
      ) : null}
      {!open ? (
        <Button className="rounded-full shadow-lg" onClick={() => setOpen(true)}>
          Chat
        </Button>
      ) : null}
    </div>
  );
}

