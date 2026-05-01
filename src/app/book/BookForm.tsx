"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FormState = {
  name: string;
  email: string;
  offer: string;
  trafficGoal: string;
  notes: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  offer: "",
  trafficGoal: "",
  notes: "",
};

export function BookForm() {
  const [form, setForm] = React.useState<FormState>(initialState);
  const [status, setStatus] = React.useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = React.useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/public/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(json.message ?? "Could not submit request");
      setStatus("success");
      setMessage("Request received. We will review the context and follow up.");
      setForm(initialState);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const update = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="book-name">
            Name
          </label>
          <Input id="book-name" value={form.name} onChange={update("name")} placeholder="Your name" className="bg-background/80" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="book-email">
            Email
          </label>
          <Input id="book-email" value={form.email} onChange={update("email")} placeholder="you@company.com" type="email" className="bg-background/80" required />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="book-offer">
          Offer
        </label>
        <Input id="book-offer" value={form.offer} onChange={update("offer")} placeholder="What are you selling?" className="bg-background/80" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="book-goal">
          Traffic goal
        </label>
        <Input id="book-goal" value={form.trafficGoal} onChange={update("trafficGoal")} placeholder="e.g. 50 leads/week from short-form" className="bg-background/80" required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="book-notes">
          Notes
        </label>
        <Textarea id="book-notes" value={form.notes} onChange={update("notes")} placeholder="Constraints, niche considerations, or links." className="bg-background/80" />
      </div>
      <Button type="submit" disabled={status === "saving"} className="w-full font-semibold shadow-md shadow-primary/20">
        {status === "saving" ? "Submitting..." : "Submit"}
      </Button>
      {message ? (
        <p className={status === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
