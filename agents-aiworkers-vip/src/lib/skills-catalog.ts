export type SkillItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  rating: number;
  installs: string;
  featured?: boolean;
  popular?: boolean;
};

export const SKILL_CATEGORIES = [
  "All",
  "Content",
  "Marketing",
  "Sales",
  "Support",
  "Analytics",
  "Automation",
  "Ecommerce",
] as const;

export const SKILLS_CATALOG: SkillItem[] = [
  {
    id: "content-writer-pro",
    name: "Content Writer Pro",
    category: "Content",
    description: "Long-form articles, briefs, and brand-voice drafts with citation-aware research.",
    rating: 4.9,
    installs: "12.4k",
    featured: true,
    popular: true,
  },
  {
    id: "social-scheduler",
    name: "Social Scheduler",
    category: "Marketing",
    description: "Cross-platform calendar, best-time posting, and UTM-tagged link batches.",
    rating: 4.8,
    installs: "9.8k",
    popular: true,
  },
  {
    id: "seo-audit-engine",
    name: "SEO Audit Engine",
    category: "Analytics",
    description: "Technical crawl, Core Web Vitals hints, and prioritized fix backlog.",
    rating: 4.9,
    installs: "8.1k",
    featured: true,
  },
  {
    id: "ads-creative-lab",
    name: "Ads Creative Lab",
    category: "Marketing",
    description: "Variant generation, hook testing matrix, and platform-specific specs.",
    rating: 4.7,
    installs: "7.2k",
    popular: true,
  },
  {
    id: "email-sequence-builder",
    name: "Email Sequence Builder",
    category: "Automation",
    description: "Nurture flows with branching, wait steps, and revenue attribution tags.",
    rating: 4.8,
    installs: "6.5k",
  },
  {
    id: "crm-sync",
    name: "CRM Sync",
    category: "Sales",
    description: "Bi-directional lead updates, stage changes, and activity logging.",
    rating: 4.6,
    installs: "5.9k",
  },
  {
    id: "support-triage",
    name: "Support Triage",
    category: "Support",
    description: "Intent classification, priority scoring, and macro suggestions.",
    rating: 4.8,
    installs: "5.4k",
    popular: true,
  },
  {
    id: "product-copy-gen",
    name: "Product Copy Gen",
    category: "Ecommerce",
    description: "SKU-aware descriptions, variant bullets, and marketplace compliance checks.",
    rating: 4.7,
    installs: "4.8k",
  },
  {
    id: "youtube-script-kit",
    name: "YouTube Script Kit",
    category: "Content",
    description: "Hook-first outlines, retention beats, and chapter markers for long-form.",
    rating: 4.9,
    installs: "4.2k",
    featured: true,
  },
  {
    id: "competitor-radar",
    name: "Competitor Radar",
    category: "Analytics",
    description: "Pricing moves, ad library snapshots, and positioning diff reports.",
    rating: 4.6,
    installs: "3.9k",
  },
  {
    id: "workflow-orchestrator",
    name: "Workflow Orchestrator",
    category: "Automation",
    description: "Multi-agent handoffs, SLA timers, and human approval gates.",
    rating: 4.9,
    installs: "3.5k",
    featured: true,
  },
  {
    id: "sentiment-monitor",
    name: "Sentiment Monitor",
    category: "Support",
    description: "Real-time tone scoring across tickets, reviews, and social mentions.",
    rating: 4.5,
    installs: "3.1k",
  },
];
