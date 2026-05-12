# AIWORKERS Growth Engine — Product flow (source of truth)

This document is the **canonical description** of the end-to-end marketing operating system: from campaign input through generation, scoring, launch, live traffic, and continuous optimization. It maps each block to **code locations** in this repository where implementation exists today.

---

## 1. The 8-step build process

| Step | Name | What it does | Where it lives in code |
|------|------|----------------|-------------------------|
| 1 | **Input** | URL, niche, goals, audience, traffic, notes; org + campaign context | Admin campaigns: `src/app/admin/campaigns/` · API: `src/app/api/admin/campaigns/` · Workspace: `src/app/api/workspace/live-build/route.ts`, `src/app/api/workspace/[campaignId]/route.ts` |
| 2 | **AI research** | Site scrape, competitive signals, market/buyer framing | Pipeline workers in `src/services/marketing-pipeline/runMarketingPipeline.ts`: `business_brief`, `offer_analyst`, `ads_analyst`, `competitor_researcher`, `landing_page_analyst` · Scrape: `src/services/web/scrapeUrlText.ts` |
| 3 | **Campaign strategy** | Positioning, offer, traffic plan | `head_of_marketing`, `brand_strategist`, `campaign_planner` in `runMarketingPipeline.ts` |
| 4 | **Funnel blueprint** | Ad → landing → capture → thank-you → follow-up structure | `page_designer` output (funnel + bridge + thank_you) in `runMarketingPipeline.ts` · Funnels admin: `src/app/api/admin/funnels/` |
| 5 | **AI generation suite** | Landing variants, ads, email, scripts, creative | `copywriter`, `scriptwriter`, `ad_designer`, `email_writer`, `landing_page_generator`, `landing_variants` in `runMarketingPipeline.ts` · Ads engine: `src/app/api/workspace/ads-engine/route.ts`, `src/services/ads/` |
| 6 | **Variant engine** | Multiple conversion angles (A/B/C style) | `landing_variants` worker + `src/ai/prompts/landing_variants.prompt.ts` · Persistence: `landing_page_variants` (see ads/migrations) · Blocks: `src/services/marketing-pipeline/landingVariantBlocks.ts` |
| 7 | **AI scoring** | Clarity, trust, CTA strength, mobile/conversion bar | `src/services/marketing-pipeline/landingCopyGuards.ts` — `validateLandingVariantQuality`, `computeLandingConversionScore`, `LANDING_CONVERSION_SCORE_MIN`, weak-CTA guards · Regen: `src/services/growth/regenerateLandingVariants.ts` · Public variant pick: `src/app/api/growth/select-variant/route.ts` |
| 8 | **Launch system** | Tracking, pixels, QA, go-live | `tracking_worker`, `lead_capture_worker`, `email_automation_worker`, `funnel_publisher`, `performance_marketer` in `runMarketingPipeline.ts` · Ads: `src/app/api/ads/prepare-launch/route.ts`, `src/app/api/ads/approve-launch/route.ts`, `src/app/api/ads/simulate-launch/route.ts` · Tracking: `src/app/api/track/postback/route.ts`, `src/app/api/events/route.ts` |

**Pipeline entrypoints**

- Run from API: `src/app/api/admin/marketing-pipeline/run/route.ts`
- Run + workspace orchestration: `src/services/workspace/liveWorkspaceBuilder.ts` (calls `runMarketingPipeline`)
- Run status / stages: `src/app/api/admin/marketing-pipeline/runs/`, `runs/[runId]/approve/route.ts`

---

## 2. Live marketing system (runtime)

| Block | Role | Code touchpoints |
|-------|------|-------------------|
| **Traffic & ads** | Campaigns, bids, creative lifecycle | `src/app/api/admin/ads/`, `src/app/api/ads/optimize/route.ts`, `src/services/ads/` |
| **Landing (live)** | Served funnel steps | `src/app/f/[campaignId]/[stepSlug]/page.tsx`, `src/app/f/[campaignId]/go/[stepSlug]/route.ts` |
| **Lead capture** | Forms → CRM | `src/app/api/leads/capture/route.ts`, `src/app/api/leads/score/route.ts` |
| **Automation** | Email/SMS, jobs | `src/app/api/cron/email-outbox/route.ts`, `src/app/api/cron/automation/route.ts`, `src/app/api/admin/email/` |
| **Analytics** | Events, dashboards | `src/app/api/events/route.ts`, `src/services/analytics/`, admin overview: `src/app/api/admin/overview/route.ts` |

---

## 3. AI optimization loop (always on)

Intended closed loop: **collect → analyze → decide → act (or propose) → measure**.

| Stage | Direction | Current / planned hooks |
|-------|-----------|---------------------------|
| Data | Performance + behavior | `analytics_events`, metrics workers (`analytics_analyst`, `cro_worker`, `report_worker`, `recommendation_worker`) in `runMarketingPipeline.ts` |
| Act / suggest | Safe automation vs human gate | Approvals (below) · Regenerate flows: `src/app/api/workspace/regenerate-section/route.ts`, `src/app/api/growth/landing-variants/route.ts` |

---

## 4. Business growth outcomes

North-star metrics the product optimizes for: **qualified leads**, **lower CAC**, **higher conversion**, **booked calls**, **predictable growth**. Implementation surfaces vary by vertical; reporting consolidates in admin/workspace analytics and pipeline outputs.

---

## 5. Cross-cutting systems

| System | Purpose | Code touchpoints |
|--------|---------|------------------|
| **Approvals** | High-risk actions require human sign-off | `src/app/api/admin/openclaw/approvals/[approvalId]/route.ts` · Pipeline stage approve: `marketing-pipeline/runs/[runId]/approve` · Ads: `src/app/api/ads/approve-launch/route.ts` |
| **AI usage & cost** | Tokens, model routing, efficiency | Worker runs persisted via `src/services/marketing-pipeline/workerRunner.ts`, env in `src/lib/env.ts` |
| **Audit logs** | Traceability | `src/services/audit/auditService.ts` (`writeAuditLog`) — e.g. org/campaign lifecycle events |
| **Security & compliance** | PII, boundaries, RLS | Supabase migrations under `supabase/migrations/` · Input validation at API routes |
| **Integrations** | Ads, billing, OAuth | Stripe: `src/app/api/stripe/` · Google OAuth: `src/app/api/admin/oauth/google/` · Cloud tools: `src/app/api/v1/cloud/tools/run/route.ts` |
| **Notifications** | Email/SMS/in-app | Email cron + templates; extend as product grows |
| **Team & roles** | Access control | `src/services/org/assertOrgAccess.ts` — `admin` / `operator` / `viewer` / `client` · Orgs: `src/app/api/admin/organizations/` |
| **Knowledge / learning** | Prompts, guards, regen quality | `src/ai/prompts/` · `landingCopyGuards.ts` · growth engine: `src/services/growth/` |

---

## 6. Related UI surfaces

| Area | Path |
|------|------|
| Admin home / shell | `src/app/admin/` |
| Organizations (switch, save, delete) | `src/app/admin/organizations/`, `src/app/api/admin/organizations/[organizationId]/route.ts` |
| Campaigns | `src/app/admin/campaigns/` |
| Marketing pipeline runs | `src/app/admin/marketing-pipeline/` (if present in tree) |
| Workspace | `src/app/admin/workspace/`, workspace API under `src/app/api/workspace/` |

---

## 7. Diagram (reference)

The full **AIWORKERS GROWTH ENGINE** architecture diagram (8-step build, live system, optimization loop, outcomes, footer capabilities) is the visual companion to this document. Keep the latest PNG/PDF with product marketing assets or check in a copy as `docs/growth-engine-flow-diagram.png` next to this file and link it here:

```markdown
![AIWORKERS Growth Engine](growth-engine-flow-diagram.png)
```

---

*Last updated: aligned with repo layout and pipeline workers as of the Growth Engine / conversion / org-admin iteration.*
