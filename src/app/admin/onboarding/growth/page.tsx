import { redirect } from "next/navigation";

import { GrowthOnboardingClient } from "@/app/admin/onboarding/growth/ui";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth/authService";
import { isOrgOperatorForUser } from "@/services/org/assertOrgAccess";

export default async function GrowthOnboardingPage() {
  const user = await requireUser();
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");
  const supabase = await createSupabaseServerClient();
  const canLaunch = await isOrgOperatorForUser(supabase, user.id, orgId);
  return <GrowthOnboardingClient organizationId={orgId} canLaunch={canLaunch} />;
}

