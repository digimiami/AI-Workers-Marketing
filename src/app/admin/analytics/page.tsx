import { redirect } from "next/navigation";

import { AnalyticsClient } from "@/app/admin/analytics/AnalyticsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAnalyticsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AnalyticsClient organizationId={orgId} />;
}
