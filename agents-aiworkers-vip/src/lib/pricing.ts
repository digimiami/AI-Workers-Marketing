export type PricingTier = {
  name: string;
  price: string;
  period: string;
  description: string;
  bullets: string[];
  featured?: boolean;
};

export const AGENTS_PRICING_TIERS: PricingTier[] = [
  {
    name: "Starter Workforce",
    price: "$299",
    period: "/month",
    description: "Deploy one specialist agent with Mission Control, approvals, and core skills.",
    bullets: [
      "1 AI worker of your choice",
      "Mission Control dashboard",
      "5 skills from marketplace",
      "Email + chat support",
      "Weekly performance reports",
    ],
  },
  {
    name: "Growth Workforce",
    price: "$799",
    period: "/month",
    description: "Run a coordinated team of agents with automation, analytics, and priority support.",
    bullets: [
      "Up to 5 AI workers",
      "Workflow automation",
      "Unlimited skill installs",
      "Priority support + onboarding",
      "Daily analytics + alerts",
      "Custom integrations",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Full workforce OS with dedicated success, SLAs, and custom agent training.",
    bullets: [
      "Unlimited AI workers",
      "Dedicated success manager",
      "Custom agent training",
      "SLA + security review",
      "White-label options",
      "API + SSO access",
    ],
  },
];

export const AGENTS_PRICING_FAQ = [
  {
    q: "Is there a free trial?",
    a: "Yes. Start a 14-day free trial with full Mission Control access and one agent deployment. No credit card required to explore the dashboard.",
  },
  {
    q: "Can I add agents later?",
    a: "Absolutely. Scale from one specialist to a full workforce. Billing adjusts when you add workers mid-cycle.",
  },
  {
    q: "What counts as a skill install?",
    a: "Skills are modular capabilities—like SEO audits or ad creative testing—that snap onto any agent. Growth and Enterprise tiers include unlimited installs.",
  },
];
