import { headers } from "next/headers";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";

import crypto from "crypto";
import { z } from "zod";

import { StructuredLandingPage } from "@/components/funnel/StructuredLandingPage";
import { funnelMainShell, funnelTopBar, type FunnelLandingVisualPreset } from "@/components/funnel/structuredLandingTheme";
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

/** Hide raw goal+traffic strings used as campaign names (e.g. "AFFILIATE · ADWORDS · …"). */
function looksLikeRawCampaignTags(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (n.includes(" · ") && n.length > 24) return true;
  if (/^(AFFILIATE|ADWORDS|GOOGLE|META|FACEBOOK|PAID\s+SOCIAL)\b/i.test(n)) return true;
  if (/\bAFFILIATE\b.*\b(GOOGLE\s+ADS|ADWORDS|META|FACEBOOK)\b/i.test(n)) return true;
  return false;
}

function isLikelyThanksOrConfirmationStep(slug: string, step: { name?: unknown; step_type?: unknown }): boolean {
  const s = slug.toLowerCase();
  if (/thanks|thank-you|thankyou|confirmation|confirm|success|complete/i.test(s)) return true;
  const nm = String(step?.name ?? "").toLowerCase();
  if (/thank|confirm|success|done|submitted/i.test(nm)) return true;
  const ty = String(step?.step_type ?? "").toLowerCase();
  if (/(thank|confirm|success)/i.test(ty)) return true;
  return false;
}

function markdownToText(md: string) {
  // Minimal markdown to text for MVP rendering without adding new deps.
  return String(md ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

/** Same-origin app path only (no open redirects). */
function pickSafeInternalHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("..")) return null;
  return t;
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
    .select("id,organization_id,funnel_id,name,status,metadata")
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
  const debugEnabled = sp?.debug === "1";
  const trackingParams = (() => {
    const pick = (k: string) => (typeof sp?.[k] === "string" ? String(sp[k]) : undefined);
    return {
      utm_source: pick("utm_source"),
      utm_medium: pick("utm_medium"),
      utm_campaign: pick("utm_campaign"),
      utm_content: pick("utm_content"),
      cid: pick("cid"),
      ad_id: pick("ad_id"),
      variant_id: pick("variant_id"),
    };
  })();
  // Landing steps are ALWAYS structured and ALWAYS sourced from landing_page_variants.
  // Other step types may opt into structured rendering via metadata.page.kind === "structured".
  const stepType = String((step as any).step_type ?? "");
  const isLandingStep = stepType === "landing";
  const wantsStructured = isLandingStep || str(page.kind) === "structured";
  const markdown = typeof page.markdown === "string" ? page.markdown : "";

  let structuredBlocks: unknown = null;
  let debugMeta: Record<string, unknown> | null = null;
  let renderSource: "variant" | "bridge_page" | "step_meta" | "none" = "none";
  let renderVariantKey: string | null = null;
  let landingFixReason: string | null = null;
  let availableVariantKeys: string[] = [];
  let funnelVisualPreset: FunnelLandingVisualPreset = "growth_dark";

  if (isLandingStep) {
    // STRICT: landing pages render ONLY from landing_page_variants.content.blocks.
    // No fallback to landing_pages snapshot, no fallback to step.metadata.page templates.
    const { data: variantRows } = await admin
      .from("landing_page_variants" as never)
      .select("id,variant_key,selected,content,updated_at")
      .eq("organization_id", String((camp as any).organization_id))
      .eq("campaign_id", String((camp as any).id))
      .eq("funnel_step_id", String((step as any).id))
      .order("updated_at", { ascending: false })
      .limit(10);
    const variantList = ((variantRows ?? []) as any[]) ?? [];
    availableVariantKeys = variantList.map((r) => String(r.variant_key ?? "")).filter(Boolean);

    const matchedVariant =
      (variantKey ? variantList.find((r) => String(r.variant_key) === variantKey) : null) ??
      variantList.find((r) => Boolean(r.selected)) ??
      null;

    const matchedContent = matchedVariant ? asRecord(matchedVariant.content) : null;
    const matchedBlocks = matchedContent ? matchedContent.blocks : null;

    console.info("[landing render] variant-lookup", {
      campaignId,
      stepId: String((step as any).id),
      requestedVariant: variantKey ?? null,
      availableVariantKeys,
      matchedVariantKey: matchedVariant ? String(matchedVariant.variant_key ?? "") : null,
      matchedHasBlocks: Boolean(matchedBlocks),
      contentHeadline:
        matchedContent && typeof matchedContent.headline === "string"
          ? String(matchedContent.headline).slice(0, 120)
          : null,
    });

    if (matchedBlocks && Array.isArray(matchedBlocks) && (matchedBlocks as unknown[]).length > 0) {
      structuredBlocks = matchedBlocks;
      renderSource = "variant";
      renderVariantKey = String(matchedVariant!.variant_key ?? "");
      funnelVisualPreset =
        matchedContent && String(matchedContent.visual_preset ?? "") === "growth_dark" ? "growth_dark" : "editorial_light";
    } else {
      // Pull the campaign's needs_generation_fix reason so we can show it.
      const ge = ((((camp as { metadata?: unknown } | null)?.metadata ?? {}) as Record<string, unknown>)
        .growth_engine ?? {}) as Record<string, unknown>;
      const fix = (ge.landing_fix ?? null) as Record<string, unknown> | null;
      landingFixReason =
        (typeof ge.landing_status === "string" ? String(ge.landing_status) : null) === "needs_generation_fix"
          ? String(fix?.reason ?? "missing_variants")
          : variantList.length === 0
            ? "missing_variants"
            : "missing_variants";
    }
  } else if (wantsStructured) {
    if (stepType === "bridge") {
      const { data: row } = await admin
        .from("bridge_pages" as never)
        .select("blocks,metadata")
        .eq("funnel_step_id", String((step as any).id))
        .eq("organization_id", String((camp as any).organization_id))
        .maybeSingle();
      structuredBlocks = (row as any)?.blocks ?? null;
      debugMeta = (row as any)?.metadata ? asRecord((row as any).metadata) : null;
      if (structuredBlocks) renderSource = "bridge_page";
    } else if (Array.isArray((page as any).blocks)) {
      structuredBlocks = (page as any).blocks;
      renderSource = "step_meta";
    }
    if (structuredBlocks && (renderSource === "bridge_page" || renderSource === "step_meta")) {
      funnelVisualPreset = "editorial_light";
    }
  }

  console.info("[landing render]", {
    campaignId,
    stepSlug,
    stepType: (step as any).step_type,
    requestedVariant: variantKey ?? null,
    renderSource,
    renderVariantKey,
    blocksCount: Array.isArray(structuredBlocks) ? (structuredBlocks as unknown[]).length : 0,
  });

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
      metadata: {
        funnel_step_id: (step as any).id,
        slug: stepSlug,
        step_type: (step as any).step_type,
        tracking: trackingParams,
        variant_key: variantKey ?? null,
      },
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

  const thanksLike =
    stepType === "thank_you" ||
    isLikelyThanksOrConfirmationStep(stepSlug, step as { name?: unknown; step_type?: unknown });

  let workspaceHref: string | null = null;
  if (thanksLike) {
    const campMeta = asRecord((camp as any).metadata);
    const ge = asRecord(campMeta.growth_engine);
    const postSubmit = asRecord(meta.post_submit);
    workspaceHref =
      pickSafeInternalHref(postSubmit.workspace_href) ??
      pickSafeInternalHref(postSubmit.href) ??
      pickSafeInternalHref(campMeta.post_submit_workspace_href) ??
      pickSafeInternalHref(ge.workspace_href);
    if (!workspaceHref) {
      const { data: latestRun } = await admin
        .from("marketing_pipeline_runs" as never)
        .select("id")
        .eq("organization_id", String((camp as any).organization_id))
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const runId = (latestRun as { id?: string } | null)?.id;
      workspaceHref = runId ? `/admin/workspace/${runId}` : `/admin/workspace/review/${campaignId}`;
    }
  }

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

  const thanksNoContent =
    !structuredBlocks &&
    !isLandingStep &&
    !markdown.trim() &&
    isLikelyThanksOrConfirmationStep(stepSlug, step as { name?: unknown; step_type?: unknown });
  const surfaceEd = funnelVisualPreset === "editorial_light";
  const shellEd = surfaceEd || thanksNoContent;
  const campName = String((camp as any).name ?? "").trim();
  const showCampHeader = Boolean(campName) && !looksLikeRawCampaignTags(campName);

  return (
    <main className={cn("min-h-screen", funnelMainShell(shellEd))}>
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
        <div className={cn("flex items-center gap-3", showCampHeader ? "justify-between" : "justify-end")}>
          {showCampHeader ? <div className={cn(funnelTopBar(shellEd))}>{campName}</div> : null}
          {nextSlug ? (
            <Link
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: shellEd ? "border-[#E2DBD2] bg-white text-[#2C2A29] hover:bg-[#F9F6F0]" : undefined,
              })}
              href={`/f/${campaignId}/${nextSlug}`}
            >
              Next
            </Link>
          ) : null}
        </div>

        {structuredBlocks ? (
          <StructuredLandingPage
            blocks={structuredBlocks}
            campaignName={String((camp as any).name ?? "")}
            organizationId={String((camp as any).organization_id)}
            campaignId={campaignId}
            funnelId={funnelId}
            funnelStepId={String((step as any).id)}
            sourcePage={`/f/${campaignId}/${stepSlug}`}
            nextHref={nextSlug ? `/f/${campaignId}/${nextSlug}` : null}
            visualPreset={funnelVisualPreset}
          />
        ) : isLandingStep ? (
          <section className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 backdrop-blur-xl md:p-8">
            <div className="text-xl font-semibold tracking-tight">Landing page not generated. Regenerate.</div>
            <p className="mt-2 text-sm text-amber-200/90">
              {landingFixReason === "scrape_failed"
                ? "We couldn't read enough content from the source URL."
                : landingFixReason === "model_unused"
                  ? "The AI provider didn't return usable copy."
                  : landingFixReason === "banned_phrase"
                    ? "The generated copy contained banned generic phrases."
                    : landingFixReason === "placeholder"
                      ? "The generated copy contained scaffolding placeholder text."
                      : landingFixReason === "not_anchored"
                        ? "The generated copy wasn't anchored to the real brand or page content."
                        : landingFixReason === "body_not_anchored"
                          ? "The variant body copy wasn't anchored to the scraped page content."
                          : "No AI-generated landing variants exist for this funnel step yet."}
            </p>
            {availableVariantKeys.length ? (
              <p className="mt-3 text-xs text-amber-200/70">
                Available variant keys: <span className="font-mono">{availableVariantKeys.join(", ")}</span>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-amber-200/70">
              Open the workspace and click <span className="font-semibold">Regenerate</span> on the Landing variants card.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {markdown ? (
              <div className="space-y-6">
                <div className="prose prose-neutral max-w-none">
                  <pre className="whitespace-pre-wrap">{markdownToText(markdown)}</pre>
                </div>
                {thanksLike && workspaceHref ? (
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={workspaceHref}
                      className={buttonVariants({
                        className: shellEd
                          ? "rounded-full bg-[#2C2A29] px-6 text-white hover:bg-[#4a4745]"
                          : undefined,
                      })}
                    >
                      Open workspace
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : thanksNoContent ? (
              <section
                className={
                  shellEd
                    ? "rounded-[1.75rem] border border-[#EDE6DD] bg-white p-8 shadow-[0_15px_40px_-20px_rgba(44,42,41,0.12)] md:p-10"
                    : "rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl md:p-8"
                }
              >
                <div
                  className={
                    shellEd
                      ? "font-[family-name:var(--font-funnel-display),ui-serif,Georgia,serif] text-3xl font-semibold tracking-tight text-[#2C2A29] md:text-4xl"
                      : "text-2xl font-semibold tracking-tight md:text-3xl"
                  }
                >
                  {String((step as any).name ?? "").trim() || "Thank you"}
                </div>
                <p className={shellEd ? "mt-4 max-w-xl text-base leading-relaxed text-[#4a4542]" : "mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground"}>
                  Your submission was received. If you asked to be contacted, we&apos;ll follow up using the details you provided.
                </p>
                {nextSlug || workspaceHref ? (
                  <div className="mt-8 flex flex-wrap gap-3">
                    {nextSlug ? (
                      <Link
                        href={`/f/${campaignId}/${nextSlug}`}
                        className={buttonVariants({
                          variant: workspaceHref ? "outline" : "default",
                          className: shellEd
                            ? workspaceHref
                              ? "rounded-full border-[#2C2A29] bg-white text-[#2C2A29] hover:bg-[#F9F6F0]"
                              : "rounded-full bg-[#2C2A29] px-6 text-white hover:bg-[#4a4745]"
                            : undefined,
                        })}
                      >
                        Continue in funnel
                      </Link>
                    ) : null}
                    {workspaceHref ? (
                      <Link
                        href={workspaceHref}
                        className={buttonVariants({
                          className: shellEd
                            ? "rounded-full bg-[#2C2A29] px-6 text-white hover:bg-[#4a4745]"
                            : undefined,
                        })}
                      >
                        Open workspace
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl md:p-8">
                <div className="text-xl font-semibold tracking-tight">This step has no content yet.</div>
                <p className="mt-2 text-sm text-muted-foreground">No structured blocks were found for this step.</p>
              </section>
            )}
          </div>
        )}

        {debugEnabled && debugMeta?.debug ? (
          <section className="rounded-3xl border border-border/60 bg-muted/10 p-6 text-sm backdrop-blur-xl">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Debug</div>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-xs font-semibold">Scraped</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-background/60 p-3 text-xs">
                  {JSON.stringify(asRecord(debugMeta.debug), null, 2)}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold">AI prompt</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-background/60 p-3 text-xs">
                  {str(asRecord(debugMeta.debug).prompt_dr)}
                </pre>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold">AI response</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-background/60 p-3 text-xs">
                  {JSON.stringify(asRecord(debugMeta.debug).response_dr ?? null, null, 2)}
                </pre>
              </div>
            </div>
          </section>
        ) : null}

        <ChatWidget
          organizationId={String((camp as any).organization_id)}
          campaignId={campaignId}
          funnelId={funnelId}
          funnelStepId={String((step as any).id)}
        />
      </div>
    </main>
  );
}

