import type { MissionWorkerDefinition, MissionWorkerKey } from "@/domain/mission-control/types";

export const MISSION_WORKERS: Record<MissionWorkerKey, MissionWorkerDefinition> = {
  marketing_worker: {
    key: "marketing_worker",
    name: "Marketing Worker",
    description: "Paid ads across Meta, Google, TikTok, and LinkedIn — copy, audiences, budgets, launch.",
    legacyAgentKeys: ["campaign_launcher", "performance_marketer", "ad_designer"],
    capabilities: [
      "meta_ads",
      "google_ads",
      "tiktok_ads",
      "linkedin_ads",
      "ad_copy",
      "audience_targeting",
      "budget_recommendations",
    ],
    integrationProviders: ["meta_ads", "google_ads", "tiktok_ads", "linkedin_ads"],
  },
  funnel_worker: {
    key: "funnel_worker",
    name: "Funnel Worker",
    description: "Landing pages, thank-you flows, lead capture, appointment funnels, CRO.",
    legacyAgentKeys: ["funnel_architect", "conversion_worker", "funnel_publisher"],
    capabilities: ["landing_pages", "funnel_steps", "lead_forms", "publish_funnel", "variant_testing"],
    integrationProviders: ["vercel"],
  },
  website_worker: {
    key: "website_worker",
    name: "Website Worker",
    description: "Full-site generation, Next.js pages, Vercel deploy, domain connection.",
    legacyAgentKeys: ["funnel_architect", "publishing_worker"],
    capabilities: ["site_generation", "nextjs_pages", "vercel_deploy", "domain_connect"],
    integrationProviders: ["vercel"],
  },
  content_worker: {
    key: "content_worker",
    name: "Content Worker",
    description: "Blog, SEO, social, video scripts, short-form, and creative assets.",
    legacyAgentKeys: ["content_strategist", "video_worker", "scriptwriter", "copywriter"],
    capabilities: ["blog_posts", "seo_articles", "social_content", "video_scripts", "creative_assets"],
    integrationProviders: ["zernio"],
  },
  email_worker: {
    key: "email_worker",
    name: "Email Worker",
    description: "Welcome, nurture, broadcast, and follow-up email sequences.",
    legacyAgentKeys: ["lead_nurture_worker", "email_writer", "email_automation_worker"],
    capabilities: ["welcome_sequences", "nurture", "broadcasts", "follow_up"],
    integrationProviders: ["resend", "mailchimp", "brevo"],
  },
  analytics_worker: {
    key: "analytics_worker",
    name: "Analytics Worker",
    description: "Campaign reporting, ROAS, CAC, conversion and funnel analysis.",
    legacyAgentKeys: ["analyst_worker", "offer_analyst", "analytics_analyst"],
    capabilities: ["campaign_reporting", "roas", "cac", "funnel_analysis", "optimization_loop"],
    integrationProviders: ["google_analytics", "posthog", "microsoft_clarity"],
  },
  crm_worker: {
    key: "crm_worker",
    name: "CRM Worker",
    description: "Lead pipeline, appointments, follow-up automation, CRM sync.",
    legacyAgentKeys: ["lead_capture_worker", "chat_closer_worker", "conversion_worker"],
    capabilities: ["lead_management", "pipeline", "appointments", "follow_up_automation"],
    integrationProviders: ["hubspot", "gohighlevel", "pipedrive"],
  },
};

export function listMissionWorkers(): MissionWorkerDefinition[] {
  return Object.values(MISSION_WORKERS);
}

export function resolveLegacyAgentKey(workerKey: MissionWorkerKey): string {
  return MISSION_WORKERS[workerKey].legacyAgentKeys[0] ?? "campaign_launcher";
}
