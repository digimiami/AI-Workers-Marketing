export type AgentCatalogRow = {
  slug: string;
  title: string;
  short_title: string;
  tagline: string;
  openclaw_agent_key: string;
  description: string;
  stripe_price_id: string | null;
  monthly_price_cents: number;
  trial_days: number;
  included_skill_keys: string[];
  status: string;
  sort_order: number;
  metadata: Record<string, unknown>;
};

export type PlatformSkillRow = {
  id: string;
  skill_key: string;
  name: string;
  category: string;
  description: string;
  markdown: string;
  agent_slug: string | null;
  version: number;
  status: string;
  rating: number;
  install_count: number;
  featured: boolean;
};

export type OrganizationAgentLicenseRow = {
  id: string;
  organization_id: string;
  agent_catalog_slug: string;
  status: string;
  source: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_checkout_session_id: string | null;
  provisioned_agent_id: string | null;
  provisioned_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
