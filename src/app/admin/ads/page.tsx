import { redirect } from "next/navigation";

import { AdsClient } from "@/app/admin/ads/AdsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAdsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return <AdsClient organizationId={orgId} />;
}
