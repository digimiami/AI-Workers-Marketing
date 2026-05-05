import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import crypto from "crypto";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ChatWidget } from "@/components/chat/ChatWidget";

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

function StructuredPage(props: { blocks: unknown }) {
  const blocks = Array.isArray(props.blocks) ? (props.blocks as unknown[]) : [];
  return (
    <div className="space-y-5">
      {blocks.map((b, idx) => {
        const o = asRecord(b);
        const type = str(o.type) || "section";
        if (type === "hero") {
          const headline = str(o.headline);
          const sub = str(o.subheadline);
          const cta = str(o.cta_label);
          return (
            <div key={idx} className="space-y-2">
              {headline ? <h1 className="text-3xl font-semibold tracking-tight">{headline}</h1> : null}
              {sub ? <p className="text-muted-foreground">{sub}</p> : null}
              {cta ? <div className={buttonVariants({})}>{cta}</div> : null}
            </div>
          );
        }
        const title = str(o.title);
        const bullets = strArr(o.bullets);
        const body = str(o.body);
        return (
          <section key={idx} className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-4">
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
            {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
            {bullets.length ? (
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {bullets.slice(0, 12).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
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
        <StructuredPage blocks={structuredBlocks} />
      ) : (
        <div className="prose prose-neutral max-w-none">
          {markdown ? <pre className="whitespace-pre-wrap">{markdownToText(markdown)}</pre> : <p>Missing page content.</p>}
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

