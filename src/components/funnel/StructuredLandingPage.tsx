import Link from "next/link";

import { Home, LineChart, MapPin, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  landingBadgePill,
  landingBenefitCard,
  landingBenefitIconWrap,
  landingFloatingBar,
  landingFormSection,
  landingHeroWrap,
  landingH1,
  landingInput,
  landingLead,
  landingPrimaryCta,
  landingProcessCard,
  landingProcessStepLabel,
  landingRibbonCard,
  landingRibbonDot,
  landingSecondaryCta,
  landingSectionLabel,
  landingSideCard,
  type FunnelLandingVisualPreset,
} from "@/components/funnel/structuredLandingTheme";
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

type BenefitItem = { title: string; desc: string };
type ProcessItem = { title: string; desc: string };
type LabeledValue = { label: string; value: string };
type Testimonial = { name: string; role: string; quote: string };
type QAItem = { question: string; answer: string };

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

const benefitIcons = [Home, MapPin, LineChart, Sparkles];

/** Hide raw goal+traffic strings used as campaign names (e.g. "AFFILIATE · ADWORDS · …"). */
function looksLikeRawCampaignTags(name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  if (n.includes(" · ") && n.length > 32) return true;
  if (/^(AFFILIATE|ADWORDS|GOOGLE|META|FACEBOOK|PAID\s+SOCIAL)\b/i.test(n)) return true;
  return false;
}

export function StructuredLandingPage(props: {
  blocks: unknown;
  campaignName: string;
  organizationId: string;
  campaignId: string;
  funnelId: string;
  funnelStepId: string;
  sourcePage: string;
  nextHref?: string | null;
  visualPreset?: FunnelLandingVisualPreset;
}) {
  const visualPreset = props.visualPreset ?? "editorial_light";
  const ed = visualPreset === "editorial_light";

  const blocks = Array.isArray(props.blocks) ? (props.blocks as unknown[]) : [];

  const hero = blocks.map(asRecord).find((b) => str(b.type) === "hero") ?? {};
  const headline = str(hero.headline);
  const subheadline = str(hero.subheadline);
  const ctaLabel = str(hero.cta_label);
  const trustLine = str(hero.trust_line) || str(hero.trustLine);
  const heroBadge = str(hero.badge) || str(hero.hero_badge);

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

  const sectionBlocks = blocks
    .map(asRecord)
    .filter((b) => str(b.type) === "section")
    .filter((b) => str(b.title).trim().toLowerCase() !== "trust");
  const offerBlock = blocks.map(asRecord).find((b) => str(b.type) === "offer") ?? null;
  const offerBullets = offerBlock ? strArr(offerBlock.bullets) : [];
  const offerItems: LabeledValue[] = offerBlock
    ? asItems(offerBlock.items)
        .map((it) => ({ label: str(it.label), value: str(it.value) }))
        .filter((x) => x.label && x.value)
    : [];
  const socialProof = blocks.map(asRecord).find((b) => str(b.type) === "social_proof") ?? null;
  const proofPoints = socialProof ? strArr(socialProof.bullets) : [];
  const testimonials: Testimonial[] = socialProof
    ? asItems(socialProof.items)
        .map((it) => ({ name: str(it.name), role: str(it.role), quote: str(it.quote) }))
        .filter((t) => t.quote)
        .slice(0, 6)
    : [];
  const objectionsBlock = blocks.map(asRecord).find((b) => str(b.type) === "objections") ?? null;
  const objections: QAItem[] = objectionsBlock
    ? asItems(objectionsBlock.items)
        .map((it) => ({ question: str(it.question), answer: str(it.answer) }))
        .filter((x) => x.question && x.answer)
        .slice(0, 8)
    : [];
  const faqBlock = blocks.map(asRecord).find((b) => str(b.type) === "faq") ?? null;
  const faqs: QAItem[] = faqBlock
    ? asItems(faqBlock.items)
        .map((it) => ({ question: str(it.question), answer: str(it.answer) }))
        .filter((x) => x.question && x.answer)
        .slice(0, 10)
    : [];
  const guaranteeBlock = blocks.map(asRecord).find((b) => str(b.type) === "guarantee") ?? null;
  const guaranteeTitle = guaranteeBlock ? str(guaranteeBlock.title) : "";
  const guaranteeBody = guaranteeBlock ? str(guaranteeBlock.body) : "";
  const finalCtaBlock = blocks.map(asRecord).find((b) => str(b.type) === "final_cta") ?? null;
  const finalHeadline = finalCtaBlock ? str(finalCtaBlock.headline) : "";
  const finalSubheadline = finalCtaBlock ? str(finalCtaBlock.subheadline) : "";
  const finalCtaLabel = finalCtaBlock ? (str(finalCtaBlock.cta_label) || str(finalCtaBlock.ctaText)) : "";

  const isValid =
    Boolean(headline.trim()) &&
    Boolean(subheadline.trim()) &&
    Boolean(ctaLabel.trim()) &&
    benefits.length >= 3 &&
    process.length >= 2;

  if (!isValid) {
    return (
      <section className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 backdrop-blur-xl md:p-8">
        <div className="text-xl font-semibold tracking-tight">Landing page not generated. Regenerate.</div>
        <p className="mt-2 text-sm text-amber-200/90">
          {!headline.trim()
            ? "Missing AI-generated headline."
            : !subheadline.trim()
              ? "Missing AI-generated subheadline."
              : !ctaLabel.trim()
                ? "Missing AI-generated CTA."
                : benefits.length < 3
                  ? `Only ${benefits.length} benefit(s) — need at least 3.`
                  : `Only ${process.length} step(s) — need at least 2.`}
        </p>
      </section>
    );
  }

  const shellCard = ed
    ? "rounded-3xl border border-[#EDE6DD] bg-white p-6 shadow-sm md:p-8"
    : "rounded-3xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl md:p-8";

  return (
    <div className={cn("space-y-12", ed && "font-[family-name:var(--font-funnel-body),ui-sans-serif,system-ui,sans-serif]")}>
      <section className={cn("relative overflow-hidden", landingHeroWrap(ed))}>
        {ed ? (
          <>
            <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-[#d4c4b0]/35 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-[#c9b8a4]/25 blur-2xl" />
          </>
        ) : (
          <>
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
          </>
        )}

        <div className="relative grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div>
            {heroBadge ? (
              <div className={landingBadgePill(ed)}>{heroBadge}</div>
            ) : props.campaignName && !looksLikeRawCampaignTags(props.campaignName) ? (
              <div className={landingBadgePill(ed)}>
                <span className={ed ? "h-1.5 w-1.5 rounded-full bg-[#9b7b5c]" : "h-1.5 w-1.5 rounded-full bg-emerald-400/90"} />
                {props.campaignName}
              </div>
            ) : null}

            <h1 className={landingH1(ed)}>{headline}</h1>
            <p className={landingLead(ed)}>{subheadline}</p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {ed ? (
                <a href={hasInlineForm ? "#lead-form" : props.nextHref || "#"} className={landingPrimaryCta(ed)}>
                  {ctaLabel}
                </a>
              ) : (
                <a href={hasInlineForm ? "#lead-form" : props.nextHref || "#"} className={buttonVariants({})}>
                  {ctaLabel}
                </a>
              )}
              {props.nextHref ? (
                ed ? (
                  <Link className={landingSecondaryCta(ed)} href={props.nextHref}>
                    Next step
                  </Link>
                ) : (
                  <Link className={buttonVariants({ variant: "outline" })} href={props.nextHref}>
                    Next step
                  </Link>
                )
              ) : null}
            </div>

            {(() => {
              const ribbon = (proofPoints.length
                ? proofPoints
                : benefits.length
                  ? benefits.map((b) => b.title)
                  : offerBullets
              ).slice(0, 3);
              if (!ribbon.length) return null;
              return (
                <div className="mt-6 grid gap-2 sm:grid-cols-3">
                  {ribbon.map((p) => (
                    <div key={p} className={landingRibbonCard(ed)}>
                      <span className={landingRibbonDot(ed)} />
                      <span className="align-middle">{p}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className={landingSideCard(ed)}>
            <div className={ed ? "font-[family-name:var(--font-funnel-body)] text-sm font-semibold text-[#2C2A29]" : "text-sm font-semibold"}>
              Get started
            </div>
            <div className={ed ? "mt-1 text-xs text-[#6b5b4e]" : "mt-1 text-xs text-muted-foreground"}>
              Takes ~30 seconds. We’ll send your next steps.
            </div>
            <div className="mt-4 space-y-3">
              {ed ? (
                <a href="#lead-form" className={cn(landingPrimaryCta(ed), "w-full justify-center")}>
                  {ctaLabel}
                </a>
              ) : (
                <a href="#lead-form" className={cn(buttonVariants({}), "w-full justify-center")}>
                  {ctaLabel}
                </a>
              )}
              {trustLine ? (
                <div
                  className={
                    ed
                      ? "rounded-2xl border border-[#EDE6DD] bg-[#F9F6F0] px-4 py-3 text-[11px] leading-relaxed text-[#5a4a3a]"
                      : "rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-[11px] text-muted-foreground"
                  }
                >
                  {trustLine}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {benefits.length ? (
        <section className="space-y-4">
          <div className={landingSectionLabel(ed)}>Benefits</div>
          <div className="grid gap-3 md:grid-cols-2">
            {benefits.slice(0, 6).map((b, i) => {
              const Icon = benefitIcons[i % benefitIcons.length];
              return (
                <div key={b.title} className={landingBenefitCard(ed)}>
                  <div className="flex items-start gap-3">
                    <div className={landingBenefitIconWrap(ed)}>
                      {ed ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : <div className="h-full w-full rounded-md bg-gradient-to-br from-cyan-400/60 to-emerald-400/40" />}
                    </div>
                    <div className="min-w-0">
                      <div className={ed ? "font-[family-name:var(--font-funnel-display),serif] text-lg font-semibold text-[#2C2A29]" : "text-base font-semibold"}>
                        {b.title}
                      </div>
                      <div className={ed ? "mt-2 text-sm leading-relaxed text-[#4a4542]" : "mt-2 text-sm leading-relaxed text-muted-foreground"}>{b.desc}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {process.length ? (
        <section className="space-y-4">
          <div className={landingSectionLabel(ed)}>How it works</div>
          <div className="grid gap-3 md:grid-cols-3">
            {process.slice(0, 3).map((s, i) => (
              <div key={s.title} className={landingProcessCard(ed)}>
                <div className={landingProcessStepLabel(ed)}>Step {i + 1}</div>
                <div className={ed ? "mt-2 font-[family-name:var(--font-funnel-display),serif] text-lg font-semibold text-[#2C2A29]" : "mt-2 text-base font-semibold"}>
                  {s.title}
                </div>
                <div className={ed ? "mt-2 text-sm leading-relaxed text-[#4a4542]" : "mt-2 text-sm leading-relaxed text-muted-foreground"}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {offerBlock && (offerBullets.length || offerItems.length) && str(offerBlock.title).trim() ? (
        <section className={shellCard}>
          <div className={landingSectionLabel(ed)}>Offer</div>
          <div className={ed ? "mt-2 font-[family-name:var(--font-funnel-display),serif] text-2xl font-semibold tracking-tight text-[#2C2A29]" : "mt-2 text-2xl font-semibold tracking-tight"}>
            {str(offerBlock.title)}
          </div>
          {offerItems.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {offerItems.slice(0, 6).map((it) => (
                <div
                  key={it.label}
                  className={ed ? "rounded-2xl border border-[#EDE6DD] bg-[#FDFAF6] p-5" : "rounded-2xl border border-border/60 bg-muted/10 p-5"}
                >
                  <div className="text-sm font-semibold">{it.label}</div>
                  <div className={ed ? "mt-2 text-sm leading-relaxed text-[#4a4542]" : "mt-2 text-sm leading-relaxed text-muted-foreground"}>{it.value}</div>
                </div>
              ))}
            </div>
          ) : null}
          {offerBullets.length ? (
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {offerBullets.slice(0, 10).map((b) => (
                <li
                  key={b}
                  className={ed ? "rounded-xl border border-[#EDE6DD] bg-white px-4 py-3 text-sm leading-relaxed text-[#4a4542]" : "rounded-xl border border-border/60 bg-muted/5 px-4 py-3 text-sm leading-relaxed"}
                >
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6">
            {ed ? (
              <a href="#lead-form" className={landingPrimaryCta(ed)}>
                {ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={buttonVariants({})}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      ) : null}

      {socialProof && (proofPoints.length || testimonials.length) ? (
        <section className="space-y-4">
          <div className={landingSectionLabel(ed)}>Proof</div>
          {proofPoints.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {proofPoints.slice(0, 6).map((p) => (
                <div
                  key={p}
                  className={ed ? "rounded-2xl border border-[#EDE6DD] bg-[#F9F6F0] p-4 text-sm text-[#4a4542]" : "rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground"}
                >
                  {p}
                </div>
              ))}
            </div>
          ) : null}
          {testimonials.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {testimonials.slice(0, 4).map((t) => (
                <div
                  key={`${t.name}-${t.quote.slice(0, 24)}`}
                  className={
                    ed
                      ? "rounded-2xl border border-[#EDE6DD] border-l-[6px] border-l-[#9b7b5c] bg-white p-5 shadow-sm"
                      : "rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl"
                  }
                >
                  {t.name ? <div className="text-sm font-semibold">{t.name}</div> : null}
                  {t.role ? <div className="mt-1 text-xs text-muted-foreground">{t.role}</div> : null}
                  <div className={ed ? "mt-3 text-sm italic leading-relaxed text-[#4a4542]" : "mt-3 text-sm leading-relaxed text-muted-foreground"}>“{t.quote}”</div>
                </div>
              ))}
            </div>
          ) : null}
          <div>
            {ed ? (
              <a href="#lead-form" className={landingSecondaryCta(ed)}>
                {ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={buttonVariants({ variant: "outline" })}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      ) : null}

      {sectionBlocks.length
        ? sectionBlocks.slice(0, 8).map((s, idx) => {
            const title = str(s.title);
            const body = str(s.body);
            const bullets = strArr(s.bullets);
            if (!title && !body && bullets.length === 0) return null;
            return (
              <section key={`${title || "section"}-${idx}`} className={ed ? shellCard : "rounded-3xl border border-border/60 bg-muted/5 p-6 md:p-8"}>
                {title ? (
                  <div className={ed ? "font-[family-name:var(--font-funnel-display),serif] text-2xl font-semibold tracking-tight text-[#2C2A29]" : "text-2xl font-semibold tracking-tight"}>
                    {title}
                  </div>
                ) : null}
                {body ? (
                  <p className={cn("text-sm leading-relaxed", ed ? "mt-3 text-[#4a4542]" : "mt-3 text-muted-foreground", title ? "" : "mt-0")}>{body}</p>
                ) : null}
                {bullets.length ? (
                  <ul className="mt-4 grid gap-2 md:grid-cols-2">
                    {bullets.slice(0, 10).map((b) => (
                      <li
                        key={b}
                        className={
                          ed
                            ? "rounded-xl border border-[#EDE6DD] bg-[#FDFAF6] px-4 py-3 text-sm leading-relaxed text-[#4a4542]"
                            : "rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
                        }
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-6">
                  {ed ? (
                    <a href="#lead-form" className={landingSecondaryCta(ed)}>
                      {ctaLabel}
                    </a>
                  ) : (
                    <a href="#lead-form" className={buttonVariants({ variant: "outline" })}>
                      {ctaLabel}
                    </a>
                  )}
                </div>
              </section>
            );
          })
        : null}

      {objections.length ? (
        <section className={shellCard}>
          <div className={landingSectionLabel(ed)}>Common questions</div>
          <div className={ed ? "mt-2 font-[family-name:var(--font-funnel-display),serif] text-2xl font-semibold tracking-tight text-[#2C2A29]" : "mt-2 text-2xl font-semibold tracking-tight"}>
            Before you continue
          </div>
          <div className="mt-4 grid gap-3">
            {objections.slice(0, 6).map((o) => (
              <div key={o.question} className={ed ? "rounded-2xl border border-[#EDE6DD] bg-[#FDFAF6] p-5" : "rounded-2xl border border-border/60 bg-muted/10 p-5"}>
                <div className="text-sm font-semibold">{o.question}</div>
                <div className={ed ? "mt-2 text-sm leading-relaxed text-[#4a4542]" : "mt-2 text-sm leading-relaxed text-muted-foreground"}>{o.answer}</div>
              </div>
            ))}
          </div>
          <div className="mt-6">
            {ed ? (
              <a href="#lead-form" className={landingPrimaryCta(ed)}>
                {ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={buttonVariants({})}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      ) : null}

      {guaranteeBlock && guaranteeTitle.trim() ? (
        <section
          className={
            ed
              ? "rounded-3xl border border-[#E9E0D3] bg-gradient-to-r from-[#F9F6F0] via-white to-[#F3EFE5] p-6 md:p-8"
              : "rounded-3xl border border-border/60 bg-gradient-to-r from-emerald-500/10 via-card to-cyan-500/10 p-6 md:p-8"
          }
        >
          <div className={landingSectionLabel(ed)}>Risk reversal</div>
          <div className={ed ? "mt-2 font-[family-name:var(--font-funnel-display),serif] text-2xl font-semibold tracking-tight text-[#2C2A29]" : "mt-2 text-2xl font-semibold tracking-tight"}>
            {guaranteeTitle}
          </div>
          {guaranteeBody ? (
            <p className={ed ? "mt-3 max-w-3xl text-sm leading-relaxed text-[#4a4542]" : "mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground"}>{guaranteeBody}</p>
          ) : null}
          <div className="mt-6">
            {ed ? (
              <a href="#lead-form" className={landingPrimaryCta(ed)}>
                {ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={buttonVariants({})}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      ) : null}

      {faqs.length ? (
        <section className="space-y-4">
          <div className={landingSectionLabel(ed)}>FAQ</div>
          <div className="grid gap-3">
            {faqs.slice(0, 8).map((f) => (
              <div key={f.question} className={ed ? "rounded-2xl border border-[#EDE6DD] bg-white p-5 shadow-sm" : "rounded-2xl border border-border/60 bg-muted/10 p-5"}>
                <div className="text-sm font-semibold">{f.question}</div>
                <div className={ed ? "mt-2 text-sm leading-relaxed text-[#4a4542]" : "mt-2 text-sm leading-relaxed text-muted-foreground"}>{f.answer}</div>
              </div>
            ))}
          </div>
          <div>
            {ed ? (
              <a href="#lead-form" className={landingPrimaryCta(ed)}>
                {ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={buttonVariants({})}>
                {ctaLabel}
              </a>
            )}
          </div>
        </section>
      ) : null}

      <section id="lead-form" className={landingFormSection(ed)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={ed ? "font-[family-name:var(--font-funnel-display),serif] text-2xl font-semibold tracking-tight text-[#2C2A29]" : "text-2xl font-semibold tracking-tight"}>
              {finalHeadline.trim() ? finalHeadline : "Get your next steps"}
            </div>
            {finalSubheadline ? (
              <p className={ed ? "mt-2 text-sm text-[#6b5b4e]" : "mt-2 text-sm text-muted-foreground"}>{finalSubheadline}</p>
            ) : null}
          </div>
          <div
            className={
              ed
                ? "rounded-full border border-[#E2DBD2] bg-[#F9F6F0] px-3 py-1 text-[11px] text-[#6b5b4e]"
                : "rounded-full border border-border/60 bg-muted/10 px-3 py-1 text-[11px] text-muted-foreground"
            }
          >
            Secure · Unsubscribe anytime
          </div>
        </div>
        <form className="mt-6 space-y-4" action="/api/leads/capture" method="post">
          <input type="hidden" name="organizationId" value={props.organizationId} />
          <input type="hidden" name="campaignId" value={props.campaignId} />
          <input type="hidden" name="funnelId" value={props.funnelId} />
          <input type="hidden" name="funnelStepId" value={props.funnelStepId} />
          <input type="hidden" name="sourcePage" value={props.sourcePage} />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className={ed ? "text-sm font-medium text-[#2C2A29]" : "text-sm font-medium"} htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" required placeholder="you@domain.com" className={landingInput(ed)} />
            </div>
            <div className="space-y-1">
              <label className={ed ? "text-sm font-medium text-[#2C2A29]" : "text-sm font-medium"} htmlFor="fullName">
                Name (optional)
              </label>
              <input id="fullName" name="fullName" type="text" placeholder="First + last" className={landingInput(ed)} />
            </div>
            <div className="space-y-1">
              <label className={ed ? "text-sm font-medium text-[#2C2A29]" : "text-sm font-medium"} htmlFor="phone">
                Phone (optional)
              </label>
              <input id="phone" name="phone" type="tel" inputMode="tel" placeholder="(555) 555‑5555" className={landingInput(ed)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {ed ? (
              <button className={cn(landingPrimaryCta(ed), "h-11 w-full justify-center md:w-auto")} type="submit">
                {ctaLabel}
              </button>
            ) : (
              <button className={cn(buttonVariants({}), "h-11 w-full justify-center md:w-auto")} type="submit">
                {ctaLabel}
              </button>
            )}
            <div className={ed ? "text-xs text-[#6b5b4e]" : "text-xs text-muted-foreground"}>
              By continuing, you agree to receive messages related to this request.
            </div>
          </div>
        </form>
      </section>

      {finalHeadline.trim() ? (
        <section
          className={
            ed
              ? "rounded-3xl border border-[#EDE6DD] bg-gradient-to-r from-[#FAF7F0] via-white to-[#F3EFE5] p-6 md:p-8"
              : "rounded-3xl border border-border/60 bg-gradient-to-r from-cyan-500/10 via-card to-emerald-500/10 p-6 md:p-8"
          }
        >
          <div className={ed ? "font-[family-name:var(--font-funnel-display),serif] text-2xl font-semibold tracking-tight text-[#2C2A29]" : "text-2xl font-semibold tracking-tight"}>
            {finalHeadline}
          </div>
          {finalSubheadline ? (
            <p className={ed ? "mt-2 text-sm text-[#6b5b4e]" : "mt-2 text-sm text-muted-foreground"}>{finalSubheadline}</p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {ed ? (
              <a href="#lead-form" className={landingPrimaryCta(ed)}>
                {finalCtaLabel || ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={buttonVariants({})}>
                {finalCtaLabel || ctaLabel}
              </a>
            )}
            {props.nextHref ? (
              ed ? (
                <Link className={landingSecondaryCta(ed)} href={props.nextHref}>
                  Skip without submitting
                </Link>
              ) : (
                <Link className={buttonVariants({ variant: "outline" })} href={props.nextHref}>
                  Skip without submitting
                </Link>
              )
            ) : null}
          </div>
        </section>
      ) : null}

      {hasInlineForm ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-3 md:hidden">
          <div className={landingFloatingBar(ed)}>
            {ed ? (
              <a href="#lead-form" className={cn(landingPrimaryCta(ed), "h-10 w-full justify-center")}>
                {ctaLabel}
              </a>
            ) : (
              <a href="#lead-form" className={cn(buttonVariants({}), "h-10 w-full justify-center")}>
                {ctaLabel}
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
