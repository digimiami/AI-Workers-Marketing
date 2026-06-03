export const AGENTS_SITE_NAME = "Agents.AIWorkers.vip";
export const AGENTS_SITE_TAGLINE = "Hire an AI Workforce That Works 24/7";
export const AGENTS_SITE_URL = "https://agents.aiworkers.vip";

/** Main product app — billing, signup, admin (separate deployment). */
export const MAIN_APP_URL = "https://aiworkers.vip";
export const MAIN_APP_SIGNUP = `${MAIN_APP_URL}/signup`;
export const MAIN_APP_BOOK = `${MAIN_APP_URL}/book`;
export const MAIN_APP_CONTACT = `${MAIN_APP_URL}/book?intent=sales`;
export const MAIN_APP_PRIVACY = `${MAIN_APP_URL}/privacy`;
export const MAIN_APP_TERMS = `${MAIN_APP_URL}/terms`;

export function agentPublicPath(slug: string): string {
  return `/agents/${slug}`;
}
