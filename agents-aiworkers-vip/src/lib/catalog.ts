export type AgentIconKey =
  | "share2"
  | "video"
  | "mail"
  | "search"
  | "megaphone"
  | "shopping-bag"
  | "headphones"
  | "bar-chart"
  | "pen-line"
  | "target";

export type AgentDefinitionData = {
  slug: string;
  title: string;
  shortTitle: string;
  tagline: string;
  iconKey: AgentIconKey;
  accent: string;
  skills: string[];
  problem: { title: string; points: string[] };
  solution: { title: string; points: string[] };
  features: { title: string; description: string }[];
  workflow: { step: string; detail: string }[];
  benefits: string[];
  results: { metric: string; label: string; detail: string }[];
  faq: { q: string; a: string }[];
  seo: { title: string; description: string; keywords: string[] };
};

const baseFaq = (role: string): { q: string; a: string }[] => [
  {
    q: `How fast can the ${role} start working?`,
    a: "Connect your accounts in Mission Control and the agent begins within minutes. Pre-built skills cover 80% of common workflows on day one.",
  },
  {
    q: "Does it replace my team?",
    a: "No—it augments them. Agents handle repetitive execution while your team sets strategy, approves high-risk outputs, and owns relationships.",
  },
  {
    q: "Can I combine this agent with others?",
    a: "Yes. Mission Control orchestrates handoffs—for example, Research → Content → Social—with shared context and one analytics layer.",
  },
  {
    q: "What integrations are supported?",
    a: "Major platforms for each role (social, ads, CRM, helpdesk, ecommerce) plus webhooks and API access on Growth and Enterprise plans.",
  },
];

export const AGENT_CATALOG_DATA: AgentDefinitionData[] = [
  {
    slug: "social-media-agent",
    title: "Social Media AI Worker",
    shortTitle: "Social Media",
    tagline: "Ship consistent social presence without burning out your team.",
    iconKey: "share2",
    accent: "from-pink-500/20 via-rose-500/10 to-fuchsia-600/20",
    skills: [
      "Content creation",
      "Scheduling",
      "Trend research",
      "Hashtag generation",
      "Community management",
      "Analytics reporting",
    ],
    problem: {
      title: "Social grows—but your team can't keep pace",
      points: [
        "Posting is inconsistent across channels",
        "Trends are spotted too late to capitalize",
        "Engagement replies pile up unanswered",
        "Reporting is manual and fragmented",
      ],
    },
    solution: {
      title: "A dedicated social operator that never clocks out",
      points: [
        "Calendar-driven publishing with brand guardrails",
        "Trend-aware content batches ready for approval",
        "Community responses drafted in your voice",
        "Unified analytics across platforms",
      ],
    },
    features: [
      { title: "Multi-platform calendar", description: "Plan LinkedIn, X, Instagram, and more from one queue with UTM discipline." },
      { title: "Trend radar", description: "Surface rising topics and hook angles before competitors saturate the feed." },
      { title: "Approval gates", description: "High-visibility posts pause for human sign-off before they go live." },
      { title: "Engagement inbox", description: "Prioritized reply drafts sorted by sentiment and follower value." },
    ],
    workflow: [
      { step: "Listen", detail: "Monitor trends, mentions, and competitor cadence." },
      { step: "Create", detail: "Generate posts, carousels, and thread variants." },
      { step: "Schedule", detail: "Queue at optimal times per channel." },
      { step: "Engage", detail: "Draft replies; escalate sensitive threads." },
      { step: "Report", detail: "Weekly reach, engagement, and content winners." },
    ],
    benefits: [
      "3× posting consistency without extra headcount",
      "Faster trend response windows",
      "Brand-safe outputs with audit trail",
      "Clear ROI on content themes",
    ],
    results: [
      { metric: "+142%", label: "Engagement lift", detail: "Avg. across pilot brands (90 days)" },
      { metric: "18h", label: "Saved weekly", detail: "Ops time reclaimed per account" },
      { metric: "94%", label: "On-brand score", detail: "Human approval pass rate" },
    ],
    faq: baseFaq("Social Media agent"),
    seo: {
      title: "Social Media AI Worker | Agents.AIWorkers.vip",
      description:
        "AI social media worker for content, scheduling, trends, hashtags, community management, and analytics. Start your free trial.",
      keywords: ["social media AI", "AI content scheduler", "community management AI"],
    },
  },
  {
    slug: "youtube-agent",
    title: "YouTube AI Worker",
    shortTitle: "YouTube",
    tagline: "From topic ideation to published videos—with SEO baked in.",
    iconKey: "video",
    accent: "from-red-500/20 via-orange-500/10 to-amber-500/20",
    skills: [
      "Topic research",
      "Script writing",
      "Thumbnail generation",
      "SEO optimization",
      "Publishing workflow",
      "Performance analysis",
    ],
    problem: {
      title: "YouTube rewards volume—but production is slow",
      points: [
        "Ideation stalls without data-backed topics",
        "Scripts take days; thumbnails are an afterthought",
        "Metadata and chapters are often skipped",
        "Performance learnings don't feed the next video",
      ],
    },
    solution: {
      title: "End-to-end YouTube production on autopilot",
      points: [
        "Keyword-aware topic pipelines",
        "Retention-structured scripts and titles",
        "Thumbnail concepts aligned to CTR patterns",
        "Publish checklist + post-mortem analytics",
      ],
    },
    features: [
      { title: "Topic pipeline", description: "Score ideas by search demand, competition, and channel fit." },
      { title: "Script studio", description: "Hook-first outlines with beats, B-roll notes, and CTA placement." },
      { title: "Thumbnail lab", description: "Multiple concepts with contrast and emotion variants." },
      { title: "SEO pack", description: "Titles, descriptions, tags, chapters, and pinned comment drafts." },
    ],
    workflow: [
      { step: "Research", detail: "Harvest topics from search + competitor gaps." },
      { step: "Script", detail: "Draft full script with retention markers." },
      { step: "Package", detail: "Thumbnails, titles, and metadata variants." },
      { step: "Publish", detail: "Checklist-driven upload workflow." },
      { step: "Analyze", detail: "CTR, retention, and next-video recommendations." },
    ],
    benefits: [
      "More videos shipped per month",
      "Higher CTR via tested titles/thumbnails",
      "SEO-complete uploads every time",
      "Closed-loop learning from analytics",
    ],
    results: [
      { metric: "2.4×", label: "Upload velocity", detail: "Teams using scripted pipelines" },
      { metric: "+38%", label: "CTR improvement", detail: "After thumbnail/title testing" },
      { metric: "12h", label: "Saved per video", detail: "Research + packaging time" },
    ],
    faq: baseFaq("YouTube agent"),
    seo: {
      title: "YouTube AI Worker | Agents.AIWorkers.vip",
      description:
        "YouTube AI agent for topics, scripts, thumbnails, SEO, publishing, and analytics. Book a demo or start free.",
      keywords: ["YouTube AI", "AI script writer", "YouTube SEO automation"],
    },
  },
  {
    slug: "email-agent",
    title: "Email Marketing AI Worker",
    shortTitle: "Email Marketing",
    tagline: "Campaigns, sequences, and revenue—without the manual grind.",
    iconKey: "mail",
    accent: "from-sky-500/20 via-blue-500/10 to-indigo-500/20",
    skills: [
      "Campaign creation",
      "Newsletter writing",
      "List segmentation",
      "Automation workflows",
      "A/B testing",
      "Revenue optimization",
    ],
    problem: {
      title: "Email ROI is there—but execution bottlenecks growth",
      points: [
        "Campaigns slip because copy takes too long",
        "Segments are outdated or too broad",
        "Automations break silently",
        "Testing is rare; winners aren't replicated",
      ],
    },
    solution: {
      title: "Revenue-focused email operations on cadence",
      points: [
        "Segment-aware campaigns with compliance checks",
        "Nurture flows that respect approval gates",
        "Continuous A/B on subject, body, and CTA",
        "Attribution tied to downstream conversions",
      ],
    },
    features: [
      { title: "Campaign builder", description: "Launch promos, launches, and newsletters from templates." },
      { title: "Segment engine", description: "Behavioral and firmographic splits refreshed automatically." },
      { title: "Automation maps", description: "Visual flows with wait steps, branches, and exit rules." },
      { title: "Revenue dashboard", description: "Per-campaign revenue, LTV cohort hints, and lift reports." },
    ],
    workflow: [
      { step: "Segment", detail: "Refresh lists from CRM and onsite behavior." },
      { step: "Compose", detail: "Draft campaigns and nurture branches." },
      { step: "Test", detail: "A/B subjects and CTAs; pick winners." },
      { step: "Send", detail: "Schedule with timezone and throttling rules." },
      { step: "Optimize", detail: "Roll learnings into the next send." },
    ],
    benefits: [
      "Higher revenue per send",
      "Fewer manual copy cycles",
      "Safer automations with approvals",
      "Clear test → winner playbook",
    ],
    results: [
      { metric: "+29%", label: "Revenue per send", detail: "Median lift after 60 days" },
      { metric: "4.2×", label: "Test velocity", detail: "Vs. manual-only teams" },
      { metric: "99.1%", label: "Deliverability", detail: "With compliance guardrails" },
    ],
    faq: baseFaq("Email Marketing agent"),
    seo: {
      title: "Email Marketing AI Worker | Agents.AIWorkers.vip",
      description:
        "Email AI worker for campaigns, newsletters, segmentation, automation, A/B tests, and revenue optimization.",
      keywords: ["email marketing AI", "AI newsletter", "marketing automation AI"],
    },
  },
  {
    slug: "seo-agent",
    title: "SEO AI Worker",
    shortTitle: "SEO",
    tagline: "Rankings grow when research, content, and technical fixes move together.",
    iconKey: "search",
    accent: "from-emerald-500/20 via-teal-500/10 to-cyan-500/20",
    skills: [
      "Keyword research",
      "Content optimization",
      "Technical SEO audits",
      "Competitor analysis",
      "Internal linking",
      "Rank tracking",
    ],
    problem: {
      title: "SEO is fragmented across tools and contractors",
      points: [
        "Keyword lists don't connect to production",
        "On-page fixes stall in dev queues",
        "Competitor moves are noticed late",
        "Reporting lacks action items",
      ],
    },
    solution: {
      title: "One SEO operator tied to your content pipeline",
      points: [
        "Prioritized keyword → brief → publish loop",
        "Technical audits with dev-ready tickets",
        "Competitor gap reports weekly",
        "Rank tracking with change alerts",
      ],
    },
    features: [
      { title: "Keyword clusters", description: "Map topics to URLs with cannibalization checks." },
      { title: "On-page optimizer", description: "Titles, metas, headings, and schema suggestions." },
      { title: "Tech audit", description: "Crawl issues, CWV, and indexation blockers." },
      { title: "Link graph", description: "Internal link opportunities scored by impact." },
    ],
    workflow: [
      { step: "Research", detail: "Cluster keywords and SERP intent." },
      { step: "Optimize", detail: "Update pages and brief new content." },
      { step: "Audit", detail: "Technical sweep with prioritized fixes." },
      { step: "Monitor", detail: "Track ranks and alert on drops." },
      { step: "Iterate", detail: "Refresh winners; prune losers." },
    ],
    benefits: [
      "Faster time-to-rank for new pages",
      "Dev-ready technical backlog",
      "Competitive visibility without agency fees",
      "Single source of SEO truth",
    ],
    results: [
      { metric: "+67%", label: "Organic traffic", detail: "Median at 6 months" },
      { metric: "340", label: "Keywords top 10", detail: "Avg. growth accounts" },
      { metric: "8h", label: "Audit turnaround", detail: "Full site technical report" },
    ],
    faq: baseFaq("SEO agent"),
    seo: {
      title: "SEO AI Worker | Agents.AIWorkers.vip",
      description:
        "SEO AI agent for keyword research, content optimization, technical audits, competitors, linking, and rank tracking.",
      keywords: ["SEO AI", "AI keyword research", "technical SEO automation"],
    },
  },
  {
    slug: "ads-agent",
    title: "Advertising AI Worker",
    shortTitle: "Advertising",
    tagline: "Spend smarter across Google and Meta with creative testing built in.",
    iconKey: "megaphone",
    accent: "from-violet-500/20 via-purple-500/10 to-fuchsia-500/20",
    skills: [
      "Google Ads management",
      "Facebook Ads management",
      "Budget optimization",
      "Creative testing",
      "Conversion tracking",
      "Campaign reporting",
    ],
    problem: {
      title: "Ad accounts leak budget without disciplined testing",
      points: [
        "Creative fatigue goes unnoticed",
        "Budget shifts are reactive, not data-led",
        "Tracking gaps distort ROAS",
        "Reporting is spread across platforms",
      ],
    },
    solution: {
      title: "Always-on media buyer with guardrails",
      points: [
        "Cross-platform campaign structure templates",
        "Creative variant matrices on schedule",
        "Budget pacing and bid recommendations",
        "Unified ROAS and cohort reporting",
      ],
    },
    features: [
      { title: "Google + Meta ops", description: "Search, PMax, and social campaigns from one playbook." },
      { title: "Creative lab", description: "Hook, headline, and visual variants with kill rules." },
      { title: "Budget guard", description: "Pacing alerts and reallocation suggestions." },
      { title: "Attribution", description: "Pixel/CAPI health checks and event maps." },
    ],
    workflow: [
      { step: "Plan", detail: "Structure campaigns by funnel stage." },
      { step: "Create", detail: "Generate and test ad creatives." },
      { step: "Launch", detail: "Deploy with tracking verification." },
      { step: "Optimize", detail: "Shift budget to winners daily." },
      { step: "Report", detail: "Executive ROAS and creative insights." },
    ],
    benefits: [
      "Lower CPA via systematic testing",
      "Fewer tracking surprises",
      "Unified cross-channel view",
      "Approval-safe spend changes",
    ],
    results: [
      { metric: "-24%", label: "CPA reduction", detail: "After 90-day optimization" },
      { metric: "3.1×", label: "Creative tests", detail: "Per month vs. baseline" },
      { metric: "+18%", label: "ROAS lift", detail: "Blended paid channels" },
    ],
    faq: baseFaq("Advertising agent"),
    seo: {
      title: "Advertising AI Worker | Agents.AIWorkers.vip",
      description:
        "AI ads worker for Google Ads, Facebook Ads, budget optimization, creative testing, conversion tracking, and reporting.",
      keywords: ["AI Google Ads", "Facebook ads AI", "paid media automation"],
    },
  },
  {
    slug: "store-agent",
    title: "Ecommerce AI Worker",
    shortTitle: "Ecommerce",
    tagline: "Catalog velocity, inventory signals, and revenue lifts—in one worker.",
    iconKey: "shopping-bag",
    accent: "from-amber-500/20 via-yellow-500/10 to-orange-500/20",
    skills: [
      "Product research",
      "Product descriptions",
      "Inventory monitoring",
      "Order management",
      "Upsell creation",
      "Revenue optimization",
    ],
    problem: {
      title: "Store ops drown in SKU work and reactive firefighting",
      points: [
        "Listings lag behind demand trends",
        "Copy is thin or duplicated across variants",
        "Stockouts and overstock hurt margin",
        "Upsells are rarely tested systematically",
      ],
    },
    solution: {
      title: "Store operator focused on merchandising and margin",
      points: [
        "Research-backed product briefs",
        "SEO-rich descriptions at scale",
        "Inventory alerts with reorder suggestions",
        "Upsell bundles tied to basket data",
      ],
    },
    features: [
      { title: "Product research", description: "Trend SKUs, margin models, and competitor price maps." },
      { title: "Copy at scale", description: "Unique descriptions per variant with compliance checks." },
      { title: "Inventory watch", description: "Threshold alerts and supplier-ready PO drafts." },
      { title: "Upsell engine", description: "Bundles, BOGO, and post-purchase offers tested weekly." },
    ],
    workflow: [
      { step: "Discover", detail: "Find products and angles with demand signals." },
      { step: "List", detail: "Publish optimized PDP copy and media briefs." },
      { step: "Monitor", detail: "Track stock, orders, and fulfillment SLAs." },
      { step: "Upsell", detail: "Test offers on cart and post-purchase." },
      { step: "Grow", detail: "Report revenue, margin, and SKU winners." },
    ],
    benefits: [
      "Faster catalog launches",
      "Higher conversion on PDPs",
      "Fewer stock surprises",
      "Measurable upsell lift",
    ],
    results: [
      { metric: "+31%", label: "Conversion rate", detail: "On optimized PDPs" },
      { metric: "-19%", label: "Stockout rate", detail: "With monitoring enabled" },
      { metric: "+22%", label: "AOV lift", detail: "From upsell experiments" },
    ],
    faq: baseFaq("Ecommerce agent"),
    seo: {
      title: "Ecommerce AI Worker | Agents.AIWorkers.vip",
      description:
        "Ecommerce AI agent for product research, descriptions, inventory, orders, upsells, and revenue optimization.",
      keywords: ["ecommerce AI", "product description AI", "shop automation"],
    },
  },
  {
    slug: "support-agent",
    title: "Customer Support AI Worker",
    shortTitle: "Customer Support",
    tagline: "Resolve faster, onboard smoother, and keep sentiment visible.",
    iconKey: "headphones",
    accent: "from-cyan-500/20 via-sky-500/10 to-blue-500/20",
    skills: [
      "Live chat support",
      "Ticket management",
      "FAQ automation",
      "Customer onboarding",
      "Knowledge base creation",
      "Sentiment analysis",
    ],
    problem: {
      title: "Support queues grow faster than hiring plans",
      points: [
        "Live chat wait times damage NPS",
        "Tickets lack consistent macros and tone",
        "KB articles are stale or missing",
        "Onboarding is manual and error-prone",
      ],
    },
    solution: {
      title: "Frontline support that escalates intelligently",
      points: [
        "Chat and ticket drafts in brand voice",
        "Auto-triage by intent, SLA, and sentiment",
        "KB generation from resolved threads",
        "Onboarding sequences with checkpoints",
      ],
    },
    features: [
      { title: "Live chat copilot", description: "Suggested replies with policy and refund guardrails." },
      { title: "Ticket ops", description: "Macros, tagging, and priority queues synced to your helpdesk." },
      { title: "FAQ bot", description: "Deflect repetitive questions with verified answers." },
      { title: "Sentiment radar", description: "Alerts on negative trends before they churn accounts." },
    ],
    workflow: [
      { step: "Triage", detail: "Classify intent and urgency." },
      { step: "Resolve", detail: "Draft responses; escalate edge cases." },
      { step: "Learn", detail: "Promote fixes into KB articles." },
      { step: "Onboard", detail: "Guide new users through setup milestones." },
      { step: "Report", detail: "CSAT, deflection, and SLA metrics." },
    ],
    benefits: [
      "Lower median response time",
      "Higher deflection without frustration",
      "Living knowledge base",
      "Proactive churn risk signals",
    ],
    results: [
      { metric: "-46%", label: "First response time", detail: "With copilot enabled" },
      { metric: "38%", label: "Deflection rate", detail: "FAQ + chat automation" },
      { metric: "+12pt", label: "CSAT lift", detail: "90-day rolling average" },
    ],
    faq: baseFaq("Support agent"),
    seo: {
      title: "Customer Support AI Worker | Agents.AIWorkers.vip",
      description:
        "Support AI worker for live chat, tickets, FAQ automation, onboarding, knowledge base, and sentiment analysis.",
      keywords: ["customer support AI", "AI helpdesk", "chatbot automation"],
    },
  },
  {
    slug: "research-agent",
    title: "Research AI Worker",
    shortTitle: "Research",
    tagline: "Market clarity delivered as briefs—not endless browser tabs.",
    iconKey: "bar-chart",
    accent: "from-indigo-500/20 via-violet-500/10 to-purple-500/20",
    skills: [
      "Market research",
      "Competitor research",
      "Trend discovery",
      "Data gathering",
      "Report generation",
      "Opportunity analysis",
    ],
    problem: {
      title: "Strategy stalls when research is slow or shallow",
      points: [
        "Competitive intel is outdated by the time it ships",
        "Trend signals are scattered across tools",
        "Reports don't connect to execution",
        "Opportunities lack quantified upside",
      ],
    },
    solution: {
      title: "Analyst-grade research on a weekly cadence",
      points: [
        "Structured market and competitor briefs",
        "Trend dashboards with confidence scores",
        "Opportunity memos with TAM/SAM hints",
        "Handoff packages for content and sales agents",
      ],
    },
    features: [
      { title: "Market scans", description: "Category sizing, pricing bands, and buyer personas." },
      { title: "Competitor dossiers", description: "Positioning, offers, ads, and content gaps." },
      { title: "Trend discovery", description: "Emerging topics ranked by velocity and fit." },
      { title: "Executive reports", description: "PDF-ready summaries with recommended actions." },
    ],
    workflow: [
      { step: "Scope", detail: "Define questions and data sources." },
      { step: "Gather", detail: "Collect structured datasets and citations." },
      { step: "Analyze", detail: "Score opportunities and risks." },
      { step: "Publish", detail: "Deliver briefs to stakeholders." },
      { step: "Activate", detail: "Trigger downstream agent workflows." },
    ],
    benefits: [
      "Faster strategic decisions",
      "Higher-quality GTM bets",
      "Shared research memory",
      "Less contractor spend",
    ],
    results: [
      { metric: "6h", label: "Brief turnaround", detail: "Standard competitive report" },
      { metric: "40+", label: "Sources per brief", detail: "With citation trail" },
      { metric: "2.8×", label: "Pipeline velocity", detail: "Research → execution handoff" },
    ],
    faq: baseFaq("Research agent"),
    seo: {
      title: "Research AI Worker | Agents.AIWorkers.vip",
      description:
        "Research AI agent for market research, competitors, trends, data gathering, reports, and opportunity analysis.",
      keywords: ["market research AI", "competitor analysis AI", "AI business intelligence"],
    },
  },
  {
    slug: "content-agent",
    title: "Content AI Worker",
    shortTitle: "Content",
    tagline: "Blogs, landing pages, and calendars—aligned to revenue goals.",
    iconKey: "pen-line",
    accent: "from-lime-500/20 via-green-500/10 to-emerald-500/20",
    skills: [
      "Blog writing",
      "Article generation",
      "Social posts",
      "Sales copy",
      "Landing pages",
      "Content calendars",
    ],
    problem: {
      title: "Content demand outstrips writer bandwidth",
      points: [
        "Editorial calendars slip every quarter",
        "Landing copy doesn't match funnel stage",
        "Social snippets are repurposed manually",
        "Quality varies by author and urgency",
      ],
    },
    solution: {
      title: "Editorial engine with brand and compliance guardrails",
      points: [
        "Brief → draft → approval → publish pipeline",
        "Landing and sales copy tied to ICP segments",
        "Atomized social from every long-form piece",
        "Calendars synced to campaigns and SEO clusters",
      ],
    },
    features: [
      { title: "Blog factory", description: "Long-form with outlines, citations, and internal links." },
      { title: "Landing copy", description: "Hero, proof, objection, and CTA blocks per variant." },
      { title: "Repurpose", description: "Threads, posts, and email snippets from one asset." },
      { title: "Calendar", description: "Channel-aware schedule with campaign tags." },
    ],
    workflow: [
      { step: "Plan", detail: "Map topics to funnel and SEO goals." },
      { step: "Draft", detail: "Generate articles and landing sections." },
      { step: "Review", detail: "Human approval for brand and claims." },
      { step: "Publish", detail: "Push to CMS and social queues." },
      { step: "Measure", detail: "Track engagement and assisted revenue." },
    ],
    benefits: [
      "Predictable publishing cadence",
      "Consistent brand voice",
      "Higher landing conversion",
      "Less agency reliance",
    ],
    results: [
      { metric: "4×", label: "Output volume", detail: "Vs. solo writer baseline" },
      { metric: "+26%", label: "Landing CVR", detail: "After copy experiments" },
      { metric: "90%", label: "Approval pass", detail: "First-draft acceptance" },
    ],
    faq: baseFaq("Content agent"),
    seo: {
      title: "Content AI Worker | Agents.AIWorkers.vip",
      description:
        "Content AI worker for blogs, articles, social posts, sales copy, landing pages, and editorial calendars.",
      keywords: ["AI content writer", "blog writing AI", "landing page copy AI"],
    },
  },
  {
    slug: "sales-agent",
    title: "Sales AI Worker",
    shortTitle: "Sales",
    tagline: "Pipeline motion—from prospect research to CRM hygiene.",
    iconKey: "target",
    accent: "from-orange-500/20 via-red-500/10 to-rose-500/20",
    skills: [
      "Lead generation",
      "Prospect research",
      "Outreach campaigns",
      "Follow-up sequences",
      "CRM updates",
      "Sales reporting",
    ],
    problem: {
      title: "Reps spend more time researching than selling",
      points: [
        "Lists decay; ICP fit is inconsistent",
        "Outreach is generic and under-tested",
        "Follow-ups fall through the cracks",
        "CRM data drifts from reality",
      ],
    },
    solution: {
      title: "SDR muscle that keeps CRM honest",
      points: [
        "ICP-scored leads with trigger events",
        "Personalized sequences with A/B hooks",
        "Automated follow-up timers and tasks",
        "Forecast-ready activity logging",
      ],
    },
    features: [
      { title: "Lead gen", description: "Lists enriched with firmographics and intent signals." },
      { title: "Prospect intel", description: "Briefs before every call with talk tracks." },
      { title: "Outreach", description: "Email + LinkedIn sequences with compliance checks." },
      { title: "CRM sync", description: "Stages, notes, and next steps always current." },
    ],
    workflow: [
      { step: "Source", detail: "Build and score lead lists." },
      { step: "Research", detail: "Account briefs and personalization tokens." },
      { step: "Outreach", detail: "Launch sequences; track replies." },
      { step: "Follow up", detail: "Nudge stalled threads automatically." },
      { step: "Report", detail: "Pipeline, activity, and conversion metrics." },
    ],
    benefits: [
      "More qualified meetings booked",
      "Less admin per rep",
      "Cleaner forecasting data",
      "Repeatable outbound playbook",
    ],
    results: [
      { metric: "+54%", label: "Meetings booked", detail: "Outbound teams (90 days)" },
      { metric: "-35%", label: "CRM admin time", detail: "Per rep per week" },
      { metric: "2.2×", label: "Reply rate", detail: "Personalized vs. generic" },
    ],
    faq: baseFaq("Sales agent"),
    seo: {
      title: "Sales AI Worker | Agents.AIWorkers.vip",
      description:
        "Sales AI agent for lead gen, prospect research, outreach, follow-ups, CRM updates, and sales reporting.",
      keywords: ["AI SDR", "sales automation AI", "outreach AI"],
    },
  },
];

export const AGENT_BY_SLUG = Object.fromEntries(
  AGENT_CATALOG_DATA.map((a) => [a.slug, a]),
) as Record<string, AgentDefinitionData>;

export const AGENT_SLUGS = AGENT_CATALOG_DATA.map((a) => a.slug);

/** Homepage marketplace cards (icons resolved in client via agent-icons) */
export const AGENT_MARKETPLACE_PREVIEW = AGENT_CATALOG_DATA.map((a) => ({
  slug: a.slug,
  title: a.shortTitle,
  description: a.tagline,
  iconKey: a.iconKey,
  skills: a.skills.slice(0, 3),
}));

export const HOMEPAGE_FAQ = [
  {
    q: "What is Agents.AIWorkers.vip?",
    a: "A dedicated storefront for hiring specialized AI workers—each built to solve a specific business function with skills you can install from our marketplace.",
  },
  {
    q: "How is this different from AiWorkers.vip?",
    a: "AiWorkers.vip is the full growth operating system. Agents is the focused hiring layer: pick a worker, connect Mission Control, and scale with modular skills.",
  },
  {
    q: "Do agents work together?",
    a: "Yes. Mission Control assigns tasks, shares context, and orchestrates handoffs—for example Research → Content → Social → Ads.",
  },
  {
    q: "Is my data secure?",
    a: "Enterprise-grade encryption, role-based access, audit logs, and optional SSO on Enterprise plans. High-risk actions require human approval.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Monthly plans cancel at period end. Annual plans include a 30-day satisfaction guarantee on Growth and Enterprise tiers.",
  },
];

export const HOMEPAGE_TESTIMONIALS = [
  {
    quote:
      "We replaced three contractors with the Social and Content agents. Mission Control keeps approvals sane.",
    name: "Jordan M.",
    role: "VP Marketing, B2B SaaS",
  },
  {
    quote:
      "The Ads agent's creative testing loop paid for the subscription in the first month.",
    name: "Priya K.",
    role: "Growth Lead, DTC Brand",
  },
  {
    quote:
      "Support deflection went up without CSAT dropping—that's the first AI pilot I'd sign again.",
    name: "Marcus T.",
    role: "Head of CX, Marketplace",
  },
];
