import { redirect } from "next/navigation";

import { GrowthOnboardingClient } from "@/app/admin/onboarding/growth/ui";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { requireUser } from "@/services/auth/authService";

export default async function GrowthOnboardingPage() {
  await requireUser();
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  return <GrowthOnboardingClient organizationId={orgId} />;
}

