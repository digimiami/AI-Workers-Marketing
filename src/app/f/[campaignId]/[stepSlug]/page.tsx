import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import crypto from "crypto";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { cn } from "@/lib/utils";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function markdownToText(md: string) {
  // Minimal markdown to text for MVP rendering without adding new deps.
  return String(md ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

type BenefitItem = { title: string; desc: string };
type ProcessItem = { title: string; desc: string };

function parseColonItem(s: string): BenefitItem | null {
  const idx = s.indexOf(":");
  if (idx < 0) return null;
  const title = s.slice(0, idx).trim();
  const desc = s.slice(idx + 1).trim();
  if (!title || !desc) return null;
  return { title, desc };
}

function asItems(v: unknown): Array<Record<string, unknown>> {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>).filter((x) => x && typeof x === "object") : [];
}

function StructuredPage(props: {
  blocks: unknown;
  campaignName: string;
  organizationId: string;
  campaignId: string;
  funnelId: string;
  funnelStepId: string;
  sourcePage: string;
  nextHref?: string | null;
}) {
  const blocks = Array.isArray(props.blocks) ? (props.blocks as unknown[]) : [];

  const hero = blocks.map(asRecord).find((b) => str(b.type) === "hero") ?? {};
  const headline = str(hero.headline);
  const subheadline = str(hero.subheadline);
  const ctaLabel = str(hero.cta_label) || "Continue";

  const benefitBlock = blocks.map(asRecord).find((b) => str(b.type) === "benefits") ?? {};
  const benefitItemsFromItems: BenefitItem[] = asItems(benefitBlock.items).map((it) => ({
    title: str(it.title),
    desc: str(it.desc) || str(it.description),
  })).filter((x) => x.title && x.desc);
  const benefitItemsFromBullets: BenefitItem[] = strArr(benefitBlock.bullets)
    .map((b) => parseColonItem(b))
    .filter((x): x is BenefitItem => Boolean(x));
  const benefits: BenefitItem[] = (benefitItemsFromItems.length ? benefitItemsFromItems : benefitItemsFromBullets).slice(0, 8);

  const processBlock =
    blocks.map(asRecord).find((b) => str(b.type) === "process" || str(b.type) === "steps") ?? {};
  const processItemsFromItems: ProcessItem[] = asItems(processBlock.items).map((it) => ({
    title: str(it.title),
    desc: str(it.desc) || str(it.description),
  })).filter((x) => x.title && x.desc);
  const processItemsFromBullets: ProcessItem[] = strArr(processBlock.bullets)
    .map((b) => parseColonItem(b))
    .filter((x): x is BenefitItem => Boolean(x))
    .map((x) => ({ title: x.title, desc: x.desc }));
  const process: ProcessItem[] = (processItemsFromItems.length ? processItemsFromItems : processItemsFromBullets).slice(0, 6);

  const hasInlineForm = blocks.map(asRecord).some((b) => str(b.type) === "lead_capture_form");

  return (
    <div className="space-y-10">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-b from-muted/25 to-background p-6 shadow-[0_0_70px_-30px_rgba(34,211,238,0.35)] md:p-10">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {props.campaignName}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
          {headline || "Get results faster — with a page built for your offer"}
        </h1>
        {subheadline ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">{subheadline}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={hasInlineForm ? "#lead-form" : props.nextHref || "#"}
            className={buttonVariants({})}
          >
            {ctaLabel || "Continue"}
          </a>
          {props.nextHref ? (
            <Link className={buttonVariants({ variant: "outline" })} href={props.nextHref}>
              Next
            </Link>
          ) : null}
        </div>
      </section>

      {benefits.length ? (
        <section className="space-y-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Benefits</div>
          <div className="grid gap-3 md:grid-cols-2">
            {benefits.slice(0, 6).map((b) => (
              <div key={b.title} className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
                <div className="text-base font-semibold">{b.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {process.length ? (
        <section className="space-y-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How it works</div>
          <div className="grid gap-3 md:grid-cols-3">
            {process.slice(0, 3).map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-border/60 bg-muted/10 p-5">
                <div className="text-xs font-semibold text-cyan-300/90">Step {i + 1}</div>
                <div className="mt-2 text-base font-semibold">{s.title}</div>
                <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section id="lead-form" className="rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl md:p-8">
        <div className="text-xl font-semibold tracking-tight">Get started in minutes</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Share your email so we can send your matches and next steps.
        </p>
        <form className="mt-5 space-y-4" action="/api/leads/capture" method="post">
          <input type="hidden" name="organizationId" value={props.organizationId} />
          <input type="hidden" name="campaignId" value={props.campaignId} />
          <input type="hidden" name="funnelId" value={props.funnelId} />
          <input type="hidden" name="funnelStepId" value={props.funnelStepId} />
          <input type="hidden" name="sourcePage" value={props.sourcePage} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="fullName">Name (optional)</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="h-11 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
              />
            </div>
          </div>
          <button className={cn(buttonVariants({}), "h-11 w-full md:w-auto") } type="submit">
            {ctaLabel || "Continue"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-border/60 bg-gradient-to-r from-cyan-500/10 via-card to-emerald-500/10 p-6 md:p-8">
        <div className="text-2xl font-semibold tracking-tight">Ready to move faster?</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Get your best options and a clear plan to act—without wasting time.
        </p>
        <div className="mt-5">
          <a href="#lead-form" className={buttonVariants({})}>{ctaLabel || "Get started"}</a>
        </div>
      </section>
    </div>
  );
}

async function buildFallbackStructuredBlocks(admin: ReturnType<typeof createSupabaseAdminClient>, params: {
  organizationId: string;
  campaignId: string;
  stepType: string;
  stepName: string;
}) {
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("name,target_audience,description,metadata")
    .eq("organization_id", params.organizationId)
    .eq("id", params.campaignId)
    .maybeSingle();

  const cName = str((camp as any)?.name) || "Campaign";
  const audience = str((camp as any)?.target_audience);
  const desc = str((camp as any)?.description);
  const meta = asRecord((camp as any)?.metadata);
  const hooksMeta = asRecord(asRecord(meta.content_hooks_scripts).hooks);

  const { data: assets } = await admin
    .from("content_assets" as never)
    .select("angles,captions,metadata,script_markdown")
    .eq("organization_id", params.organizationId)
    .eq("campaign_id", params.campaignId)
    .order("created_at", { ascending: false })
    .limit(50);

  const hooks: string[] = [];
  for (const a of (assets ?? []) as any[]) {
    if (Array.isArray(a.angles)) for (const x of a.angles) if (typeof x === "string" && x.trim()) hooks.push(x.trim());
    if (Array.isArray(a.captions)) for (const x of a.captions) if (typeof x === "string" && x.trim()) hooks.push(x.trim());
    if (hooks.length >= 8) break;
  }

  const headline =
    hooks[0] ||
    (desc ? desc.split("\n")[0]?.slice(0, 90) : "") ||
    `${cName}: ${params.stepName}`;

  const sub =
    audience ? `Built for: ${audience}` : desc ? desc.slice(0, 160) : "Generated by AiWorkers.";

  const cta = params.stepType === "thank_you" ? "Back to start" : "Continue";

  return [
    { type: "hero", headline, subheadline: sub, cta_label: cta },
    { type: "benefits", items: hooks.slice(0, 4).map((h, i) => ({ title: `Benefit ${i + 1}`, desc: h })) },
    { type: "process", items: [{ title: "Share your criteria", desc: "Answer a few questions so we can match you correctly." }, { title: "Review options", desc: "Get a short list of best-fit options." }, { title: "Take the next step", desc: "Book or continue with the right CTA." }] },
    { type: "lead_capture_form" },
    { type: "final_cta" },
  ];
}

export default async function PublicFunnelStepPage(props: {
  params: Promise<{ campaignId: string; stepSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { campaignId, stepSlug } = await props.params;
  const sp = await props.searchParams;
  if (!z.string().uuid().safeParse(campaignId).success) redirect("/");

  const admin = createSupabaseAdminClient();
  const { data: camp } = await admin
    .from("campaigns" as never)
    .select("id,organization_id,funnel_id,name,status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) notFound();

  const funnelId = (camp as any).funnel_id ? String((camp as any).funnel_id) : null;
  if (!funnelId) notFound();

  const { data: step } = await admin
    .from("funnel_steps" as never)
    .select("id,funnel_id,step_index,name,step_type,slug,is_public,metadata")
    .eq("funnel_id", funnelId)
    .eq("slug", stepSlug)
    .eq("is_public", true)
    .maybeSingle();
  if (!step) notFound();

  const meta = ((step as any).metadata ?? {}) as Record<string, unknown>;
  const page = asRecord(meta.page);
  const variantKey = typeof sp?.variant === "string" ? sp.variant : undefined;
  const wantsStructured = str(page.kind) === "structured";
  const markdown = typeof page.markdown === "string" ? page.markdown : "";

  // If structured, prefer rendering from landing_pages/bridge_pages blocks.
  let structuredBlocks: unknown = null;
  if (wantsStructured) {
    if ((step as any).step_type === "landing") {
      const { data: rows } = await admin
        .from("landing_pages" as never)
        .select("blocks,metadata,created_at")
        .eq("funnel_step_id", String((step as any).id))
        .eq("organization_id", String((camp as any).organization_id))
        .order("created_at", { ascending: false })
        .limit(10);
      const match =
        (rows ?? []).find((r: any) => (asRecord(r.metadata).variant_key as any) === variantKey) ??
        (rows ?? [])[0];
      structuredBlocks = match?.blocks ?? null;
    } else if ((step as any).step_type === "bridge") {
      const { data: row } = await admin
        .from("bridge_pages" as never)
        .select("blocks")
        .eq("funnel_step_id", String((step as any).id))
        .eq("organization_id", String((camp as any).organization_id))
        .maybeSingle();
      structuredBlocks = (row as any)?.blocks ?? null;
    } else if (Array.isArray((page as any).blocks)) {
      structuredBlocks = (page as any).blocks;
    }
  }

  // Log page_view (server-side)
  try {
    const h = await headers();
    const ua = h.get("user-agent");
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ipHash = ip ? crypto.createHash("sha256").update(ip).digest("hex") : null;
    await admin.from("analytics_events" as never).insert({
      organization_id: (camp as any).organization_id,
      campaign_id: campaignId,
      funnel_id: funnelId,
      event_name: "page_view",
      source: "public.funnel",
      user_agent: ua,
      ip_hash: ipHash,
      metadata: { funnel_step_id: (step as any).id, slug: stepSlug, step_type: (step as any).step_type },
    } as never);
  } catch {
    // best-effort
  }

  const nextStep = await admin
    .from("funnel_steps" as never)
    .select("slug,step_type")
    .eq("funnel_id", funnelId)
    .eq("is_public", true)
    .gt("step_index", (step as any).step_index)
    .order("step_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextSlug = (nextStep.data as any)?.slug ? String((nextStep.data as any).slug) : null;

  if ((step as any).step_type === "cta") {
    redirect(`/f/${campaignId}/go/${stepSlug}`);
  }

  if ((step as any).step_type === "form") {
    const leadCapture = (meta.lead_capture ?? {}) as Record<string, unknown>;
    const endpoint = typeof leadCapture.endpoint === "string" ? leadCapture.endpoint : "/api/leads/capture";
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{(step as any).name}</h1>
          <p className="text-sm text-muted-foreground">Enter your email to get the next step.</p>
        </div>
        <form
          className="space-y-4 rounded-xl border p-4"
          action={endpoint}
          method="post"
        >
          <input type="hidden" name="organizationId" value={String((camp as any).organization_id)} />
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="funnelId" value={funnelId} />
          <input type="hidden" name="funnelStepId" value={String((step as any).id)} />
          <input type="hidden" name="sourcePage" value={`/f/${campaignId}/${stepSlug}`} />
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="fullName">Name (optional)</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button className={buttonVariants({})} type="submit">Continue</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">{String((camp as any).name ?? "")}</div>
        <h1 className="text-3xl font-semibold tracking-tight">{String((step as any).name ?? "")}</h1>
      </div>

      {structuredBlocks ? (
        <StructuredPage
          blocks={structuredBlocks}
          campaignName={String((camp as any).name ?? "")}
          organizationId={String((camp as any).organization_id)}
          campaignId={campaignId}
          funnelId={funnelId}
          funnelStepId={String((step as any).id)}
          sourcePage={`/f/${campaignId}/${stepSlug}`}
          nextHref={nextSlug ? `/f/${campaignId}/${nextSlug}` : null}
        />
      ) : (
        <div className="prose prose-neutral max-w-none">
          {markdown ? (
            <pre className="whitespace-pre-wrap">{markdownToText(markdown)}</pre>
          ) : (
            <StructuredPage
              blocks={await buildFallbackStructuredBlocks(admin, {
                organizationId: String((camp as any).organization_id),
                campaignId,
                stepType: String((step as any).step_type ?? ""),
                stepName: String((step as any).name ?? "Step"),
              })}
              campaignName={String((camp as any).name ?? "")}
              organizationId={String((camp as any).organization_id)}
              campaignId={campaignId}
              funnelId={funnelId}
              funnelStepId={String((step as any).id)}
              sourcePage={`/f/${campaignId}/${stepSlug}`}
              nextHref={nextSlug ? `/f/${campaignId}/${nextSlug}` : null}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {nextSlug ? (
          <Link className={buttonVariants({})} href={`/f/${campaignId}/${nextSlug}`}>
            Next
          </Link>
        ) : null}
        <Link className={buttonVariants({ variant: "outline" })} href={`/f/${campaignId}/go/${stepSlug}`}>
          CTA
        </Link>
      </div>

      <ChatWidget
        organizationId={String((camp as any).organization_id)}
        campaignId={campaignId}
        funnelId={funnelId}
        funnelStepId={String((step as any).id)}
      />
    </main>
  );
}

