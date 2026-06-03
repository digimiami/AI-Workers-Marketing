import { redirect } from "next/navigation";

const AGENTS_PLATFORM_ADMIN =
  process.env.NEXT_PUBLIC_AGENTS_PLATFORM_ADMIN_URL ?? "https://agents.aiworkers.vip/admin";

/** Platform catalog + skill training lives on agents.aiworkers.vip, not aiworkers.vip admin. */
export default function AgentMarketplaceRedirectPage() {
  redirect(AGENTS_PLATFORM_ADMIN);
}
