import { redirect } from "next/navigation";

import { GrowthOnboardingClient } from "@/app/admin/onboarding/growth/ui";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";
import { isOrgOperator } from "@/services/org/assertOrgAccess";

export default async function GrowthOnboardingPage() {
  await requireUser();
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  const supabase = await createSupabaseServerClient();
  const canLaunch = await isOrgOperator(supabase, orgId);
  return <GrowthOnboardingClient organizationId={orgId} canLaunch={canLaunch} />;
}

